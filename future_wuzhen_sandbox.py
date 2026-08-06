"""
元宇宙乌镇未来馆：赛博水乡全息数据沙盘

使用方法：
1. 在 Blender 的 Scripting 工作区打开本文件。
2. 点击 Run Script。
3. 如需导出 glTF/GLB，可在脚本末尾调用 export_gltf(...)
   或在 Blender Python Console 中执行：
       export_gltf(r"C:\\path\\future_wuzhen.glb")

设计原则：
- 数据流全部由 150 个普通八面体网格组成，不使用原生粒子，便于 Three.js/glTF 导出。
- 全息材质保留 Emission + Transparent + Fresnel + 扫描线节点；同时创建
  Holo_Shader_GLTF 作为导出时的 Principled PBR 兼容材质。
- 对 Eevee 3.x、4.x、5.x 的引擎和属性名称做了兼容处理。
"""

import math
from mathutils import Vector
import bpy


# -----------------------------------------------------------------------------
# 通用工具
# -----------------------------------------------------------------------------

SCENE_NAME = "Future_Wuzhen_Sandbox"
ROOT_COLLECTION = "WU_ZHEN_FUTURE_EXHIBIT"
GLTF_COLLECTION = "WUZHEN_GLTF_EXPORT"
ENV_COLLECTION = "WUZHEN_ENVIRONMENT"
DATA_COLLECTION = "WUZHEN_DATA_FLOW"
DOME_COLLECTION = "WUZHEN_DOME"
PILLAR_COLLECTION = "WUZHEN_PILLARS"
LOTUS_COLLECTION = "WUZHEN_LOTUS_MATRIX"
ENTRANCE_COLLECTION = "WUZHEN_ENTRANCE"


def set_socket(node, aliases, value):
    """按 identifier 或显示名称设置节点输入，避免中文界面导致找不到 socket。"""
    aliases = set(aliases)
    for socket in node.inputs:
        if socket.identifier in aliases or socket.name in aliases:
            socket.default_value = value
            return socket
    return None


def get_socket(node, aliases):
    """按 identifier 或显示名称获取节点输入。"""
    aliases = set(aliases)
    for socket in node.inputs:
        if socket.identifier in aliases or socket.name in aliases:
            return socket
    return None


def find_node(nodes, node_type):
    """通过类型查找节点，不依赖 Blender 的本地化节点名称。"""
    return next((node for node in nodes if node.type == node_type), None)


def move_to_collection(obj, target_collection):
    """将对象从默认集合移动到目标集合。"""
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    target_collection.objects.link(obj)


def set_material_transparency(material):
    """兼容不同 Blender 版本的透明材质设置。"""
    try:
        material.surface_render_method = "DITHERED"
    except Exception:
        try:
            material.blend_method = "BLEND"
            material.use_screen_refraction = True
        except Exception:
            pass


def make_pbr_material(name, base_color, metallic=0.0, roughness=0.4,
                      emission_color=None, emission_strength=0.0):
    """创建 glTF 友好的 Principled PBR 材质。"""
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.name = "Material_Output"
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.name = "Principled_PBR"
    shader.location = (-220, 0)
    output.location = (80, 0)

    set_socket(shader, {"Base Color", "base_color", "基础色"}, (*base_color, 1.0))
    set_socket(shader, {"Metallic", "metallic", "金属度"}, metallic)
    set_socket(shader, {"Roughness", "roughness", "粗糙度"}, roughness)
    if emission_color is not None:
        set_socket(shader, {"Emission", "Emission Color", "emission_color", "发光", "发光颜色"},
                   (*emission_color, 1.0))
        set_socket(shader, {"Emission Strength", "emission_strength", "发光强度"},
                   emission_strength)
    links.new(shader.outputs[0], output.inputs["Surface"])
    return material


def make_emission_material(name, color, strength):
    """创建纯发光材质，适合线框、数据碎片和霓虹灯带。"""
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (*color, 1.0)
    emission.inputs["Strength"].default_value = strength
    links.new(emission.outputs[0], output.inputs["Surface"])
    return material


def iter_action_fcurves(action):
    """兼容 Blender 3.x/4.x 的 Action.fcurves 与 5.2 的分层 Action API。"""
    if action is None:
        return []
    if hasattr(action, "fcurves"):
        return list(action.fcurves)

    fcurves = []
    for layer in getattr(action, "layers", []):
        for strip in getattr(layer, "strips", []):
            for slot in getattr(action, "slots", []):
                try:
                    channelbag = strip.channelbag(slot)
                    fcurves.extend(list(channelbag.fcurves))
                except Exception:
                    pass
    return fcurves


def add_cycles_modifier(action):
    """让动画曲线首尾循环，导出 glTF 后仍由关键帧驱动。"""
    for fcurve in iter_action_fcurves(action):
        for keyframe in fcurve.keyframe_points:
            keyframe.interpolation = "LINEAR"
        if not any(mod.type == "CYCLES" for mod in fcurve.modifiers):
            fcurve.modifiers.new(type="CYCLES")


def look_at(obj, target):
    """让摄像机或灯光朝向目标点。"""
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


# -----------------------------------------------------------------------------
# 清理并初始化场景
# -----------------------------------------------------------------------------


def clear_scene():
    """清空物体、集合、材质和孤立数据，保证脚本重复运行结果一致。"""
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        try:
            bpy.ops.object.mode_set(mode="OBJECT")
        except Exception:
            pass

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    # 删除旧集合，但保留 Scene Collection 这个根集合。
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)

    # 彻底清理旧材质和常见孤立数据块。
    datablock_names = (
        "materials",
        "meshes",
        "curves",
        "cameras",
        "lights",
        "armatures",
        "particles",
        "grease_pencils_v3",
        "grease_pencils",
        "volumes",
        "textures",
    )
    for datablock_name in datablock_names:
        datablocks = getattr(bpy.data, datablock_name, None)
        if datablocks is None:
            continue
        for datablock in list(datablocks):
            try:
                datablocks.remove(datablock)
            except Exception:
                pass

    scene = bpy.context.scene
    scene.name = SCENE_NAME

    # Eevee 枚举名称在不同 Blender 版本中不同，动态选择当前版本支持的名称。
    engine_property = scene.render.bl_rna.properties.get("engine")
    engine_ids = {item.identifier for item in engine_property.enum_items} if engine_property else set()
    if "BLENDER_EEVEE_NEXT" in engine_ids:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    elif "BLENDER_EEVEE" in engine_ids:
        scene.render.engine = "BLENDER_EEVEE"
    else:
        scene.render.engine = next(iter(engine_ids), scene.render.engine)

    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.frame_start = 1
    scene.frame_end = 250
    scene.frame_set(1)

    # 黑色世界背景。
    world = bpy.data.worlds.get("Wuzhen_Black_World") or bpy.data.worlds.new("Wuzhen_Black_World")
    scene.world = world
    world.use_nodes = True
    background = find_node(world.node_tree.nodes, "BACKGROUND")
    if background:
        background.inputs["Color"].default_value = (0.0, 0.0, 0.0, 1.0)
        background.inputs["Strength"].default_value = 0.0

    # Eevee 旧属性：Bloom、SSR、AO。新版移除的功能由合成器 FOG_GLOW 兜底。
    eevee = getattr(scene, "eevee", None)
    if eevee:
        for attr, value in (("use_bloom", True), ("use_ssr", True), ("use_gtao", True)):
            if hasattr(eevee, attr):
                try:
                    setattr(eevee, attr, value)
                except Exception:
                    pass
        for attr, value in (("bloom_threshold", 0.5), ("gtao_distance", 3.0), ("gtao_factor", 1.25)):
            if hasattr(eevee, attr):
                try:
                    setattr(eevee, attr, value)
                except Exception:
                    pass

    # Blender 4/5 中 Eevee Bloom 已移除，用 Compositor Glare 保证视觉一致。
    scene.use_nodes = True
    # Blender 5.2 通过 compositing_node_group 暴露合成器节点树，旧版则可直接读取 node_tree。
    compositor = getattr(scene, "node_tree", None) or getattr(scene, "compositing_node_group", None)
    if compositor is None:
        # Blender 5.2 初始文件可能没有自动创建合成器组，手动创建并挂回场景。
        compositor = bpy.data.node_groups.new(SCENE_NAME + "_Compositor", "CompositorNodeTree")
        scene.compositing_node_group = compositor
    try:
        compositor.nodes.clear()
        render_layers = compositor.nodes.new("CompositorNodeRLayers")
        glare = compositor.nodes.new("CompositorNodeGlare")
        # Glare 节点的属性在 Blender 5.2 有所收敛，逐项探测后再设置。
        for attr, value in (("glare_type", "FOG_GLOW"), ("quality", "HIGH"),
                            ("threshold", 0.5), ("size", 7)):
            if hasattr(glare, attr):
                try:
                    setattr(glare, attr, value)
                except Exception:
                    pass
        composite = compositor.nodes.new("CompositorNodeComposite")
        compositor.links.new(render_layers.outputs["Image"], glare.inputs["Image"])
        compositor.links.new(glare.outputs["Image"], composite.inputs["Image"])
    except Exception as exc:
        # Blender 5.2 的新合成器可能没有旧版 Composite 输出节点；材质发光仍然可用。
        print("Optional compositor bloom skipped:", repr(exc))
        try:
            compositor.nodes.clear()
        except Exception:
            pass
        # 没有输出节点的合成器会阻止渲染结果写入文件，显式回退到 Eevee 直接输出。
        try:
            scene.compositing_node_group = None
        except Exception:
            pass
        scene.use_nodes = False

    # 创建导出集合和环境集合：glTF 导出时只选择 WUZHEN_GLTF_EXPORT。
    root = bpy.data.collections.new(ROOT_COLLECTION)
    scene.collection.children.link(root)
    export_collection = bpy.data.collections.new(GLTF_COLLECTION)
    environment_collection = bpy.data.collections.new(ENV_COLLECTION)
    data_collection = bpy.data.collections.new(DATA_COLLECTION)
    dome_collection = bpy.data.collections.new(DOME_COLLECTION)
    pillar_collection = bpy.data.collections.new(PILLAR_COLLECTION)
    lotus_collection = bpy.data.collections.new(LOTUS_COLLECTION)
    entrance_collection = bpy.data.collections.new(ENTRANCE_COLLECTION)
    root.children.link(export_collection)
    root.children.link(environment_collection)
    root.children.link(data_collection)
    root.children.link(dome_collection)
    root.children.link(pillar_collection)
    root.children.link(lotus_collection)
    root.children.link(entrance_collection)

    return (scene, export_collection, environment_collection, data_collection,
            dome_collection, pillar_collection, lotus_collection, entrance_collection)


# -----------------------------------------------------------------------------
# 物理展台
# -----------------------------------------------------------------------------


def create_pedestal(export_collection):
    """创建半径 3m、高度 0.8m 的暗黑拉丝金属圆柱展台。"""
    metal = make_pbr_material(
        "Dark_Brushed_Metal",
        (0.0667, 0.0667, 0.0667),
        metallic=1.0,
        roughness=0.3,
    )

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=128,
        radius=3.0,
        depth=0.8,
        location=(0.0, 0.0, 0.0),
    )
    pedestal = bpy.context.object
    pedestal.name = "Pedestal_Dark_Brushed_Metal"
    move_to_collection(pedestal, export_collection)
    pedestal.data.materials.append(metal)

    bevel = pedestal.modifiers.new("Pedestal_Rounded_Edges", "BEVEL")
    bevel.width = 0.12
    bevel.segments = 6

    # 细长环形霓虹灯带，使用标准网格，glTF 可直接导出。
    neon = make_pbr_material(
        "Neon_Cyan_Glow",
        (0.0, 0.12, 0.2),
        metallic=0.15,
        roughness=0.22,
        emission_color=(0.0, 0.8, 1.0),
        emission_strength=20.0,
    )
    bpy.ops.mesh.primitive_torus_add(
        major_radius=2.87,
        minor_radius=0.028,
        major_segments=128,
        minor_segments=12,
        location=(0.0, 0.0, 0.405),
    )
    neon_ring = bpy.context.object
    neon_ring.name = "Pedestal_Neon_Cyan_Ring"
    move_to_collection(neon_ring, export_collection)
    neon_ring.data.materials.append(neon)

    # 第二圈低亮辅助边缘，让实体展台在 WebGL 中也有清晰轮廓。
    bpy.ops.mesh.primitive_torus_add(
        major_radius=2.70,
        minor_radius=0.012,
        major_segments=128,
        minor_segments=8,
        location=(0.0, 0.0, 0.43),
    )
    inner_ring = bpy.context.object
    inner_ring.name = "Pedestal_Neon_Inner_Ring"
    move_to_collection(inner_ring, export_collection)
    inner_ring.data.materials.append(neon)

    return pedestal, neon_ring


# -----------------------------------------------------------------------------
# 全息乌镇地形沙盘
# -----------------------------------------------------------------------------


def create_holo_shader():
    """创建 Holo_Shader：Fresnel 边缘光 + Z 轴扫描线 + 透明混合。"""
    material = bpy.data.materials.new("Holo_Shader")
    material.use_nodes = True
    set_material_transparency(material)
    material["gltf_export_material"] = "Holo_Shader_GLTF"
    material["description"] = "Emission + Transparent + Layer Weight Fresnel + animated Wave scanline"

    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.name = "Holo_Output"
    output.label = "Hologram Preview Output"
    output.location = (720, 40)

    mix_shader = nodes.new("ShaderNodeMixShader")
    mix_shader.name = "Fresnel_Scan_Mix"
    mix_shader.label = "Fresnel + Scanline Mix"
    mix_shader.location = (470, 40)

    transparent = nodes.new("ShaderNodeBsdfTransparent")
    transparent.name = "Transparent_BSDF"
    transparent.location = (210, -110)

    emission = nodes.new("ShaderNodeEmission")
    emission.name = "Cyan_Emission_Strength_15"
    emission.label = "Cyan Emission / Strength 15"
    emission.location = (210, 120)
    emission.inputs["Color"].default_value = (0.0, 0.55, 1.0, 1.0)
    emission.inputs["Strength"].default_value = 15.0

    layer_weight = nodes.new("ShaderNodeLayerWeight")
    layer_weight.name = "Layer_Weight_Facing"
    layer_weight.label = "Facing / Fresnel"
    layer_weight.location = (-520, 230)

    invert_facing = nodes.new("ShaderNodeMath")
    invert_facing.name = "Invert_Facing_To_Edge"
    invert_facing.operation = "SUBTRACT"
    invert_facing.location = (-280, 240)
    invert_facing.inputs[0].default_value = 1.0

    texcoord = nodes.new("ShaderNodeTexCoord")
    texcoord.name = "Generated_Coordinates"
    texcoord.location = (-760, -220)

    mapping = nodes.new("ShaderNodeMapping")
    mapping.name = "Animated_Scan_Mapping_Z"
    mapping.label = "Animated Z Scan Offset"
    mapping.location = (-520, -180)

    wave = nodes.new("ShaderNodeTexWave")
    wave.name = "Z_Axis_Scan_Wave"
    wave.label = "Z Axis Scanning Wave"
    wave.wave_type = "BANDS"
    wave.bands_direction = "Z"
    wave.location = (-250, -130)
    set_socket(wave, {"Scale", "scale"}, 12.0)
    set_socket(wave, {"Distortion", "distortion"}, 0.0)
    set_socket(wave, {"Detail", "detail"}, 0.0)

    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.name = "Scanline_ColorRamp"
    ramp.label = "Thin Moving Scanline"
    ramp.location = (0, -140)
    ramp.color_ramp.elements[0].position = 0.43
    ramp.color_ramp.elements[0].color = (0.0, 0.0, 0.0, 1.0)
    ramp.color_ramp.elements[1].position = 0.57
    ramp.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1.0)

    max_factor = nodes.new("ShaderNodeMath")
    max_factor.name = "Fresnel_Or_Scanline"
    max_factor.operation = "MAXIMUM"
    max_factor.location = (250, 70)

    links.new(layer_weight.outputs["Facing"], invert_facing.inputs[1])
    links.new(invert_facing.outputs[0], max_factor.inputs[0])
    links.new(texcoord.outputs["Generated"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], wave.inputs["Vector"])
    links.new(wave.outputs["Color"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], max_factor.inputs[1])
    links.new(max_factor.outputs[0], mix_shader.inputs[0])
    links.new(transparent.outputs[0], mix_shader.inputs[1])
    links.new(emission.outputs[0], mix_shader.inputs[2])
    links.new(mix_shader.outputs[0], output.inputs["Surface"])

    # 扫描线沿 Z 轴平移，添加 Cycles 让动画持续循环。
    location_socket = mapping.inputs.get("Location")
    if location_socket:
        location_socket.default_value = (0.0, 0.0, 0.0)
        location_socket.keyframe_insert("default_value", index=2, frame=1)
        location_socket.default_value[2] = -4.0
        location_socket.keyframe_insert("default_value", index=2, frame=250)
        if material.node_tree.animation_data and material.node_tree.animation_data.action:
            add_cycles_modifier(material.node_tree.animation_data.action)

    return material


def create_terrain(export_collection):
    """创建半径 2.8m、Z=0.9m 的圆形置换地形和精细线框。"""
    holo = create_holo_shader()
    holo_gltf = make_pbr_material(
        "Holo_Shader_GLTF",
        (0.0, 0.16, 0.28),
        metallic=0.05,
        roughness=0.28,
        emission_color=(0.0, 0.55, 1.0),
        emission_strength=8.0,
    )
    holo_gltf["preview_material"] = "Holo_Shader"

    bpy.ops.mesh.primitive_circle_add(
        vertices=128,
        radius=2.8,
        fill_type="NGON",
        location=(0.0, 0.0, 0.9),
    )
    terrain = bpy.context.object
    terrain.name = "Wuzhen_Hologram_Terrain"
    move_to_collection(terrain, export_collection)

    # 通过编辑模式细分 150 次，获得足够密集的置换/线框拓扑。
    bpy.context.view_layer.objects.active = terrain
    terrain.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.subdivide(number_cuts=150, smoothness=0.0)
    bpy.ops.object.mode_set(mode="OBJECT")

    # 旧版纹理 API 仍是 Displace Modifier 的跨版本稳定入口。
    voronoi = bpy.data.textures.new("Wuzhen_Voronoi_Distance_To_Edge", type="VORONOI")
    for attr, value in (
        ("noise_scale", 0.22),
        ("noise_intensity", 1.0),
        ("contrast", 1.8),
        ("nabla", 0.03),
    ):
        if hasattr(voronoi, attr):
            try:
                setattr(voronoi, attr, value)
            except Exception:
                pass
    # 不同版本可能使用 noise_type 或 distance 两个不同字段名。
    for attr in ("noise_type", "distance"):
        if hasattr(voronoi, attr):
            try:
                setattr(voronoi, attr, "DISTANCE_TO_EDGE")
            except Exception:
                pass

    displacement = terrain.modifiers.new("Voronoi_Terrain_Displacement", "DISPLACE")
    displacement.texture = voronoi
    displacement.texture_coords = "GLOBAL"
    displacement.strength = 0.42
    displacement.mid_level = 0.48

    wireframe = terrain.modifiers.new("Fine_Holographic_Wireframe", "WIREFRAME")
    wireframe.thickness = 0.008
    wireframe.use_replace = True
    wireframe.use_even_offset = True
    terrain.data.materials.append(holo)
    terrain.data.materials.append(holo_gltf)
    terrain["gltf_material"] = "Holo_Shader_GLTF"
    terrain["subdivision_cuts"] = 150
    terrain["displacement_texture"] = "DISTANCE_TO_EDGE"

    return terrain


# -----------------------------------------------------------------------------
# 符号化地标：中央数据拱桥
# -----------------------------------------------------------------------------


def create_arch_bridge(export_collection):
    """用参数化半圆管生成拱桥白模，避免依赖易变的布尔修改器。"""
    gold = make_pbr_material(
        "Wuzhen_Gold_Glow",
        (0.34, 0.12, 0.015),
        metallic=0.55,
        roughness=0.24,
        emission_color=(1.0, 0.18, 0.015),
        emission_strength=12.0,
    )

    major_radius = 0.92
    tube_radius = 0.105
    center_z = 1.02
    arc_segments = 36
    tube_segments = 12
    vertices = []
    faces = []

    for i in range(arc_segments + 1):
        theta = math.pi * i / arc_segments
        for j in range(tube_segments):
            phi = 2.0 * math.pi * j / tube_segments
            radial = major_radius + tube_radius * math.cos(phi)
            vertices.append((
                radial * math.cos(theta),
                tube_radius * math.sin(phi),
                center_z + radial * math.sin(theta),
            ))

    for i in range(arc_segments):
        for j in range(tube_segments):
            a = i * tube_segments + j
            b = i * tube_segments + (j + 1) % tube_segments
            c = (i + 1) * tube_segments + (j + 1) % tube_segments
            d = (i + 1) * tube_segments + j
            faces.append((a, b, c, d))

    mesh = bpy.data.meshes.new("Wuzhen_Data_Arch_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    bridge = bpy.data.objects.new("Wuzhen_Cyber_Data_Arch", mesh)
    export_collection.objects.link(bridge)
    bridge.data.materials.append(gold)
    bridge["landmark"] = "Wuzhen Water Town Cyber Arch"
    return bridge


# -----------------------------------------------------------------------------
# glTF 友好的双螺旋数据流
# -----------------------------------------------------------------------------


def create_octahedron_mesh():
    """创建共享八面体网格；150 个对象共享同一份 mesh，减少 glTF 体积。"""
    size = 0.055
    vertices = [
        (0.0, 0.0, size),
        (size, 0.0, 0.0),
        (0.0, size, 0.0),
        (-size, 0.0, 0.0),
        (0.0, -size, 0.0),
        (0.0, 0.0, -size),
    ]
    faces = [
        (0, 1, 2), (0, 2, 3), (0, 3, 4), (0, 4, 1),
        (5, 2, 1), (5, 3, 2), (5, 4, 3), (5, 1, 4),
    ]
    mesh = bpy.data.meshes.new("Data_Shard_Octahedron_Shared_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    return mesh


def animate_double_helix_shard(obj, angle, base_z, radius, phase):
    """为单个数据碎片添加首尾闭合的双螺旋动画。"""
    # 1 -> 125 -> 250：完成一周绕行，中心上抬后回到原高度，循环无跳变。
    keyframes = (
        (1, angle, base_z, 0.0),
        (125, angle + math.pi, base_z + 0.34, math.pi),
        (250, angle + 2.0 * math.pi, base_z, 2.0 * math.pi),
    )
    for frame, orbit_angle, z_value, self_rotation in keyframes:
        obj.location = (
            radius * math.cos(orbit_angle),
            radius * math.sin(orbit_angle),
            z_value,
        )
        obj.rotation_euler[2] = self_rotation
        obj.keyframe_insert(data_path="location", frame=frame)
        obj.keyframe_insert(data_path="rotation_euler", index=2, frame=frame)

    add_cycles_modifier(obj.animation_data.action if obj.animation_data else None)


def create_double_helix(data_collection):
    """创建 150 个八面体数据碎片，沿两条相位相反的螺旋线分布。"""
    shard_material = make_pbr_material(
        "Data_Shard_Cyan_Glow",
        (0.0, 0.2, 0.34),
        metallic=0.1,
        roughness=0.2,
        emission_color=(0.0, 0.75, 1.0),
        emission_strength=18.0,
    )
    shared_mesh = create_octahedron_mesh()
    count = 150
    helix_radius = 0.58

    for index in range(count):
        strand_phase = 0.0 if index % 2 == 0 else math.pi
        # 让碎片从展台上方 1.25m 排布到 4.25m，形成竖向双螺旋。
        normalized = index / float(count - 1)
        base_z = 1.25 + normalized * 3.0
        angle = normalized * 8.0 * math.pi + strand_phase

        shard = bpy.data.objects.new("Data_Shard_%03d" % index, shared_mesh)
        data_collection.objects.link(shard)
        shard.data.materials.append(shard_material)
        shard.rotation_mode = "XYZ"
        shard["gltf_animated"] = True
        shard["trajectory"] = "double_helix"
        animate_double_helix_shard(shard, angle, base_z, helix_radius, strand_phase)

    return count


# -----------------------------------------------------------------------------
# 氛围光影与摄像机
# -----------------------------------------------------------------------------


def create_environment(environment_collection, export_collection):
    """创建青蓝向上面光源、体积雾包围盒和展示摄像机。"""
    light_data = bpy.data.lights.new("Hologram_Uplight_Data", type="AREA")
    light_data.energy = 1000.0
    light_data.color = (0.0, 0.45, 1.0)
    light_data.shape = "DISK"
    light_data.size = 4.8
    uplight = bpy.data.objects.new("Hologram_Uplight", light_data)
    environment_collection.objects.link(uplight)
    uplight.location = (0.0, 0.0, 0.46)
    # Area Light 默认沿本地 -Z 发光，旋转 180 度后朝上。
    uplight.rotation_euler = (math.pi, 0.0, 0.0)
    uplight["gltf_export"] = False

    # 使用 Principled Volume，保证 Blender 预览中出现蓝色体积雾。
    fog_material = bpy.data.materials.new("Deep_Blue_Principled_Volume")
    fog_material.use_nodes = True
    nodes = fog_material.node_tree.nodes
    links = fog_material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    volume = nodes.new("ShaderNodeVolumePrincipled")
    volume.location = (-220, 0)
    set_socket(volume, {"Density", "density", "密度"}, 0.05)
    set_socket(volume, {"Color", "color", "颜色"}, (0.002, 0.012, 0.065, 1.0))
    set_socket(volume, {"Anisotropy", "anisotropy", "各向异性"}, 0.38)
    links.new(volume.outputs["Volume"], output.inputs["Volume"])

    bpy.ops.mesh.primitive_cube_add(
        location=(0.0, 0.0, 2.7),
        scale=(4.25, 4.25, 3.2),
    )
    fog_box = bpy.context.object
    fog_box.name = "Wuzhen_Volumetric_Fog_Box"
    move_to_collection(fog_box, environment_collection)
    fog_box.data.materials.append(fog_material)
    fog_box.display_type = "WIRE"
    fog_box["gltf_export"] = False
    fog_box["volume_density"] = 0.05
    fog_box["volume_absorption_color"] = "deep_blue"

    # 展示摄像机，方便 F12/F11 直接查看结果。
    camera_data = bpy.data.cameras.new("Future_Wuzhen_Camera_Data")
    camera = bpy.data.objects.new("Future_Wuzhen_Camera", camera_data)
    export_collection.objects.link(camera)
    # 巨型殿堂的默认镜头位于月洞门正前方，保留入口、穹顶与中心沙盘的纵深关系。
    camera.location = (0.0, -30.0, 11.5)
    camera_data.lens = 43
    camera_data.sensor_width = 36
    look_at(camera, (0.0, 1.0, 5.3))
    bpy.context.scene.camera = camera
    camera["gltf_export"] = False

    return uplight, fog_box, camera


# -----------------------------------------------------------------------------
# 场馆扩建：呼吸感光电路地板
# -----------------------------------------------------------------------------


def create_circuit_floor(export_collection):
    """创建 30m x 30m 的暗黑地板，并用 Voronoi 距离边缘生成电路纹理。"""
    floor_material = bpy.data.materials.new("Breathing_Circuit_Floor")
    floor_material.use_nodes = True
    floor_material["description"] = "Voronoi Distance To Edge circuit lines with cyclic emission breathing"
    floor_material["gltf_export_material"] = "Breathing_Circuit_Floor_GLTF"
    make_pbr_material(
        "Breathing_Circuit_Floor_GLTF",
        (0.004, 0.008, 0.014),
        metallic=0.8,
        roughness=0.3,
        emission_color=(0.0, 0.22, 0.36),
        emission_strength=2.0,
    )

    nodes = floor_material.node_tree.nodes
    links = floor_material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (760, 40)
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.name = "Circuit_Floor_Principled"
    principled.location = (500, 40)
    set_socket(principled, {"Base Color", "base_color", "基础色"}, (0.006, 0.008, 0.012, 1.0))
    set_socket(principled, {"Metallic", "metallic", "金属度"}, 0.85)
    set_socket(principled, {"Roughness", "roughness", "粗糙度"}, 0.29)
    set_socket(principled, {"Emission Strength", "emission_strength", "发光强度"}, 1.0)

    texcoord = nodes.new("ShaderNodeTexCoord")
    texcoord.location = (-760, 40)
    mapping = nodes.new("ShaderNodeMapping")
    mapping.name = "Circuit_Mapping"
    mapping.location = (-560, 40)
    set_socket(mapping, {"Scale", "scale"}, (1.2, 1.2, 1.0))

    voronoi = nodes.new("ShaderNodeTexVoronoi")
    voronoi.name = "Circuit_Voronoi_Distance_To_Edge"
    voronoi.location = (-330, 40)
    try:
        voronoi.feature = "DISTANCE_TO_EDGE"
    except Exception:
        pass
    try:
        voronoi.distance = "EUCLIDEAN"
    except Exception:
        pass
    set_socket(voronoi, {"Scale", "scale"}, 7.0)

    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.name = "Circuit_Line_ColorRamp"
    ramp.location = (-60, 40)
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.0, 0.82, 1.0, 1.0)
    ramp.color_ramp.elements[1].position = 0.026
    ramp.color_ramp.elements[1].color = (0.0, 0.0, 0.0, 1.0)

    links.new(texcoord.outputs["Generated"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], voronoi.inputs["Vector"])
    links.new(voronoi.outputs.get("Distance", voronoi.outputs[0]), ramp.inputs["Fac"])
    if get_socket(principled, {"Emission Color", "Emission", "emission_color", "发光", "发光颜色"}):
        links.new(ramp.outputs["Color"], get_socket(principled, {"Emission Color", "Emission", "emission_color", "发光", "发光颜色"}))
    links.new(principled.outputs[0], output.inputs["Surface"])

    # 地面呼吸灯：1 -> 5 -> 1，并用 Cycles 修改器无限循环。
    emission_strength = get_socket(principled, {"Emission Strength", "emission_strength", "发光强度"})
    if emission_strength:
        for frame, value in ((1, 1.0), (60, 5.0), (120, 1.0)):
            emission_strength.default_value = value
            emission_strength.keyframe_insert("default_value", frame=frame)
        if floor_material.node_tree.animation_data:
            add_cycles_modifier(floor_material.node_tree.animation_data.action)

    bpy.ops.mesh.primitive_plane_add(size=30.0, location=(0.0, 0.0, -0.01))
    floor = bpy.context.object
    floor.name = "Breathing_Circuit_Floor_30m"
    move_to_collection(floor, export_collection)
    floor.data.materials.append(floor_material)
    floor["gltf_animated_material"] = True
    floor["layout_role"] = "exhibition_floor"
    return floor


# -----------------------------------------------------------------------------
# 场馆扩建：世界互联网数据流瀑布墙
# -----------------------------------------------------------------------------


def create_data_waterfall(export_collection):
    """创建正后方 1/4 圆弧曲面屏，并用材质 Mapping 动画模拟金色数据瀑布。"""
    material = bpy.data.materials.new("Data_Waterfall")
    material.use_nodes = True
    material["description"] = "Animated gold and blue data waterfall; no video texture"
    material["gltf_export_material"] = "Data_Waterfall_GLTF"
    make_pbr_material(
        "Data_Waterfall_GLTF",
        (0.008, 0.01, 0.025),
        metallic=0.1,
        roughness=0.28,
        emission_color=(0.85, 0.12, 0.03),
        emission_strength=4.5,
    )
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (760, 40)
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.name = "Waterfall_Principled"
    principled.location = (500, 40)
    set_socket(principled, {"Metallic", "metallic", "金属度"}, 0.05)
    set_socket(principled, {"Roughness", "roughness", "粗糙度"}, 0.32)
    set_socket(principled, {"Emission Strength", "emission_strength", "发光强度"}, 6.5)

    texcoord = nodes.new("ShaderNodeTexCoord")
    texcoord.location = (-760, 40)
    mapping = nodes.new("ShaderNodeMapping")
    mapping.name = "Waterfall_UV_Scroll_Mapping"
    mapping.location = (-560, 40)
    set_socket(mapping, {"Scale", "scale"}, (1.0, 20.0, 1.0))

    noise = nodes.new("ShaderNodeTexNoise")
    noise.name = "Waterfall_Stretched_Noise"
    noise.label = "Height Stretched Noise X1 Y20 Z1"
    noise.location = (-320, 40)
    set_socket(noise, {"Scale", "scale"}, 1.8)
    set_socket(noise, {"Detail", "detail"}, 2.0)
    set_socket(noise, {"Roughness", "roughness"}, 0.55)

    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.name = "Waterfall_Gold_Blue_ColorRamp"
    ramp.location = (-40, 40)
    ramp.color_ramp.elements[0].position = 0.38
    ramp.color_ramp.elements[0].color = (0.0, 0.002, 0.008, 1.0)
    ramp.color_ramp.elements[1].position = 0.55
    ramp.color_ramp.elements[1].color = (1.0, 0.18, 0.01, 1.0)
    middle = ramp.color_ramp.elements.new(0.49)
    middle.color = (0.02, 0.22, 0.9, 1.0)
    tail = ramp.color_ramp.elements.new(0.63)
    tail.color = (0.0, 0.002, 0.008, 1.0)

    links.new(texcoord.outputs["Generated"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    color_input = get_socket(principled, {"Base Color", "base_color", "基础色"})
    emission_input = get_socket(principled, {"Emission Color", "Emission", "emission_color", "发光", "发光颜色"})
    if color_input:
        links.new(ramp.outputs["Color"], color_input)
    if emission_input:
        links.new(ramp.outputs["Color"], emission_input)
    links.new(principled.outputs[0], output.inputs["Surface"])

    # 对 Mapping 的 Y 坐标打关键帧，线性向下滚动并循环。
    location = mapping.inputs.get("Location")
    if location:
        location.default_value = (0.0, 0.0, 0.0)
        location.keyframe_insert("default_value", index=1, frame=1)
        location.default_value[1] = -5.0
        location.keyframe_insert("default_value", index=1, frame=250)
        if material.node_tree.animation_data and material.node_tree.animation_data.action:
            for fcurve in iter_action_fcurves(material.node_tree.animation_data.action):
                for keyframe in fcurve.keyframe_points:
                    keyframe.interpolation = "LINEAR"
            add_cycles_modifier(material.node_tree.animation_data.action)

    # 1/4 圆弧 Bezier 曲线，局部原点严格放在 (0, 8, 0)。
    curve_data = bpy.data.curves.new("Data_Waterfall_Quarter_Bezier_Curve", type="CURVE")
    curve_data.dimensions = "2D"
    curve_data.resolution_u = 16
    curve_data.fill_mode = "BOTH"
    curve_data.extrude = 3.0  # 总高度约 6m
    spline = curve_data.splines.new("BEZIER")
    arc_segments = 8
    spline.bezier_points.add(arc_segments)
    radius = 8.5
    local_center_y = -7.5
    for index, point in enumerate(spline.bezier_points):
        theta = math.radians(45.0 + 90.0 * index / arc_segments)
        point.co = (radius * math.cos(theta), local_center_y + radius * math.sin(theta), 0.0)
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"

    wall = bpy.data.objects.new("World_Internet_Data_Waterfall", curve_data)
    export_collection.objects.link(wall)
    wall.location = (0.0, 8.0, 3.0)
    curve_data.materials.append(material)
    wall["layout_location"] = "(0, 8, 0)"
    wall["source_geometry"] = "Bezier quarter arc with 6m extrusion"

    # 将曲线转为普通网格，后续 glTF/Three.js 不依赖 Blender 曲线解释器。
    bpy.ops.object.select_all(action="DESELECT")
    wall.select_set(True)
    bpy.context.view_layer.objects.active = wall
    try:
        bpy.ops.object.convert(target="MESH")
    except Exception:
        pass
    wall = bpy.context.object
    wall.name = "World_Internet_Data_Waterfall"
    wall["gltf_static_mesh"] = True
    return wall


# -----------------------------------------------------------------------------
# 场馆扩建：左侧数字人主理人唤醒舱
# -----------------------------------------------------------------------------


def create_awaken_chamber(export_collection, data_collection):
    """创建 (-6, 0, 0) 数字人唤醒台、6 块玻璃面板和公转 Empty。"""
    center = (-6.0, 0.0, 0.0)
    base_material = make_pbr_material(
        "Awaken_Pad_Black_Glow",
        (0.004, 0.006, 0.012),
        metallic=0.85,
        roughness=0.24,
        emission_color=(0.0, 0.22, 0.42),
        emission_strength=6.0,
    )
    glass_material = bpy.data.materials.new("Awaken_Glass_Emission")
    glass_material.use_nodes = True
    glass_material["gltf_export_material"] = "Awaken_Glass_Emission_GLTF"
    make_pbr_material(
        "Awaken_Glass_Emission_GLTF",
        (0.01, 0.15, 0.24),
        metallic=0.1,
        roughness=0.18,
        emission_color=(0.0, 0.42, 0.8),
        emission_strength=3.0,
    )
    set_material_transparency(glass_material)
    nodes = glass_material.node_tree.nodes
    links = glass_material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    mix = nodes.new("ShaderNodeMixShader")
    glass = nodes.new("ShaderNodeBsdfGlass")
    emission = nodes.new("ShaderNodeEmission")
    glass.inputs["Color"].default_value = (0.02, 0.25, 0.4, 1.0)
    set_socket(glass, {"Roughness", "roughness"}, 0.12)
    set_socket(glass, {"IOR", "ior"}, 1.45)
    emission.inputs["Color"].default_value = (0.0, 0.55, 1.0, 1.0)
    emission.inputs["Strength"].default_value = 7.0
    mix.inputs[0].default_value = 0.58
    links.new(glass.outputs[0], mix.inputs[1])
    links.new(emission.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs["Surface"])

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=96,
        radius=1.5,
        depth=0.2,
        location=(center[0], center[1], 0.1),
    )
    pad = bpy.context.object
    pad.name = "Digital_Human_Awaken_Pad"
    move_to_collection(pad, export_collection)
    pad.data.materials.append(base_material)

    bevel = pad.modifiers.new("Awaken_Pad_Bevel", "BEVEL")
    bevel.width = 0.06
    bevel.segments = 4

    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.42,
        minor_radius=0.035,
        major_segments=96,
        minor_segments=10,
        location=(center[0], center[1], 0.22),
    )
    pad_ring = bpy.context.object
    pad_ring.name = "Digital_Human_Awaken_Neon_Ring"
    move_to_collection(pad_ring, export_collection)
    pad_ring.data.materials.append(base_material)

    empty = bpy.data.objects.new("Awaken_Chamber_Orbit_Rig", None)
    data_collection.objects.link(empty)
    empty.empty_display_type = "CIRCLE"
    empty.empty_display_size = 2.0
    empty.location = center
    empty.rotation_mode = "XYZ"
    empty.rotation_euler[2] = 0.0
    empty.keyframe_insert(data_path="rotation_euler", index=2, frame=1)
    empty.rotation_euler[2] = math.tau
    empty.keyframe_insert(data_path="rotation_euler", index=2, frame=250)
    add_cycles_modifier(empty.animation_data.action if empty.animation_data else None)
    empty["layout_location"] = "(-6, 0, 0)"
    empty["interaction_role"] = "digital_human_awaken_chamber"

    panel_count = 6
    panel_radius = 2.0
    panels = []
    for index in range(panel_count):
        angle = math.tau * index / panel_count
        panel = bpy.data.meshes.new("Awaken_Glass_Panel_%02d_Mesh" % index)
        # 竖直矩形面板：局部 X 为宽度，局部 Z 为高度。
        panel_vertices = [(-0.55, 0.0, -0.9), (0.55, 0.0, -0.9),
                          (0.55, 0.0, 0.9), (-0.55, 0.0, 0.9)]
        panel.from_pydata(panel_vertices, [], [(0, 1, 2, 3)])
        panel.update()
        panel_object = bpy.data.objects.new("Awaken_Glass_Panel_%02d" % index, panel)
        export_collection.objects.link(panel_object)
        panel_object.data.materials.append(glass_material)
        panel_object.parent = empty
        panel_object.location = (panel_radius * math.cos(angle),
                                 panel_radius * math.sin(angle), 1.35)
        panel_object.rotation_euler = (0.0, 0.0, angle + math.pi / 2.0)
        panel_object["raycast_id"] = "awaken_panel_%02d" % index
        panel_object["interaction_module"] = "digital_human_explainer_%02d" % index
        panels.append(panel_object)

    # 增加一圈低矮扫描环，强化唤醒舱的舞台边界。
    bpy.ops.mesh.primitive_torus_add(
        major_radius=2.0,
        minor_radius=0.012,
        major_segments=96,
        minor_segments=8,
        location=(center[0], center[1], 0.03),
    )
    scan_ring = bpy.context.object
    scan_ring.name = "Awaken_Chamber_Outer_Scan_Ring"
    move_to_collection(scan_ring, export_collection)
    scan_ring.data.materials.append(base_material)

    return empty, panels


# -----------------------------------------------------------------------------
# 场馆扩建：右侧光子算力织布机
# -----------------------------------------------------------------------------


def gradient_color(t):
    """蓝 -> 青 -> 紫的三段渐变，用于写入网格顶点色。"""
    t = max(0.0, min(1.0, t))
    if t < 0.5:
        u = t * 2.0
        return (0.03 * (1.0 - u), 0.35 + 0.55 * u, 1.0)
    u = (t - 0.5) * 2.0
    return (0.05 + 0.75 * u, 0.9 * (1.0 - u), 1.0)


def create_fiber_material():
    """使用顶点色驱动发光，导出 glTF 后不依赖 Blender 程序纹理。"""
    material = bpy.data.materials.new("Photon_Fiber_Gradient_Glow")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    vertex_color = nodes.new("ShaderNodeVertexColor")
    vertex_color.layer_name = "FiberColor"
    set_socket(principled, {"Metallic", "metallic", "金属度"}, 0.05)
    set_socket(principled, {"Roughness", "roughness", "粗糙度"}, 0.18)
    emission_strength = set_socket(principled, {"Emission Strength", "emission_strength", "发光强度"}, 14.0)
    links.new(vertex_color.outputs["Color"], get_socket(principled, {"Base Color", "base_color", "基础色"}))
    emission_input = get_socket(principled, {"Emission Color", "Emission", "emission_color", "发光", "发光颜色"})
    if emission_input:
        links.new(vertex_color.outputs["Color"], emission_input)
    links.new(principled.outputs[0], output.inputs["Surface"])
    material["vertex_color_layer"] = "FiberColor"
    material["gltf_ready"] = True
    return material


def create_fiber_tube_mesh():
    """创建 100 根带厚度的光纤管线，并为每个横截面写入渐变顶点色。"""
    vertices = []
    faces = []
    vertex_colors = []
    radial_segments = 6
    path_points = 5
    fiber_count = 100
    ring_radius = 1.45
    left_x, right_x = 4.0, 8.0
    center_z = 1.9

    for fiber_index in range(fiber_count):
        left_angle = math.tau * fiber_index / fiber_count
        # 右端采用相反排序，使 100 根光纤交错形成织布纹理。
        right_angle = -left_angle * 1.17 + 0.65
        p_left = Vector((left_x,
                         ring_radius * math.cos(left_angle),
                         center_z + ring_radius * math.sin(left_angle)))
        p_right = Vector((right_x,
                          ring_radius * math.cos(right_angle),
                          center_z + ring_radius * math.sin(right_angle)))
        path = []
        for point_index in range(path_points):
            t = point_index / float(path_points - 1)
            base = p_left.lerp(p_right, t)
            # 中央收束、再展开，形成具有织布机特征的沙漏形光纤群。
            convergence = math.sin(math.pi * t)
            phase = left_angle + fiber_index * 0.13
            y_offset = 0.95 * convergence * math.sin(phase + math.pi * t)
            z_offset = 0.65 * convergence * math.cos(phase + math.pi * t)
            path.append(Vector((base.x, base.y + y_offset, base.z + z_offset)))

        path_start = len(vertices)
        for point_index, point in enumerate(path):
            if point_index == 0:
                tangent = path[1] - path[0]
            elif point_index == len(path) - 1:
                tangent = path[-1] - path[-2]
            else:
                tangent = path[point_index + 1] - path[point_index - 1]
            tangent.normalize()
            reference = Vector((0.0, 0.0, 1.0))
            if abs(tangent.dot(reference)) > 0.92:
                reference = Vector((0.0, 1.0, 0.0))
            normal_a = tangent.cross(reference).normalized()
            normal_b = tangent.cross(normal_a).normalized()
            tube_radius = 0.018
            for radial_index in range(radial_segments):
                phi = math.tau * radial_index / radial_segments
                offset = tube_radius * (math.cos(phi) * normal_a + math.sin(phi) * normal_b)
                vertices.append(tuple(point + offset))
                vertex_colors.append(gradient_color(point_index / float(path_points - 1)))

        for point_index in range(path_points - 1):
            for radial_index in range(radial_segments):
                a = path_start + point_index * radial_segments + radial_index
                b = path_start + point_index * radial_segments + (radial_index + 1) % radial_segments
                c = path_start + (point_index + 1) * radial_segments + (radial_index + 1) % radial_segments
                d = path_start + (point_index + 1) * radial_segments + radial_index
                faces.append((a, b, c, d))

    mesh = bpy.data.meshes.new("Photon_Fiber_100_Tube_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()

    # 将渐变写入 CORNER 域，Blender glTF 导出器会将其作为 COLOR_0 导出。
    try:
        color_attribute = mesh.color_attributes.new(
            name="FiberColor",
            type="FLOAT_COLOR",
            domain="CORNER",
        )
        for polygon in mesh.polygons:
            for loop_index in polygon.loop_indices:
                vertex_index = mesh.loops[loop_index].vertex_index
                color_attribute.data[loop_index].color = (*vertex_colors[vertex_index], 1.0)
    except Exception:
        # 老版本 Blender 使用 vertex_colors API。
        try:
            color_layer = mesh.vertex_colors.new(name="FiberColor")
            for polygon in mesh.polygons:
                for loop_index in polygon.loop_indices:
                    vertex_index = mesh.loops[loop_index].vertex_index
                    color_layer.data[loop_index].color = (*vertex_colors[vertex_index], 1.0)
        except Exception:
            pass
    return mesh


def create_photon_loom(export_collection):
    """创建右侧 (6, 0, 0) 的暗金圆环织布机、100 根光纤和算力棱柱。"""
    frame_material = make_pbr_material(
        "Photon_Loom_Dark_Gold_Frame",
        (0.18, 0.055, 0.01),
        metallic=0.72,
        roughness=0.24,
        emission_color=(0.42, 0.07, 0.005),
        emission_strength=3.0,
    )
    fiber_material = create_fiber_material()
    core_material = make_pbr_material(
        "Photon_Compute_Core",
        (0.08, 0.02, 0.22),
        metallic=0.25,
        roughness=0.16,
        emission_color=(0.55, 0.04, 1.0),
        emission_strength=35.0,
    )

    for side, x in (("L", 4.0), ("R", 8.0)):
        bpy.ops.mesh.primitive_torus_add(
            major_radius=1.45,
            minor_radius=0.065,
            major_segments=96,
            minor_segments=12,
            location=(x, 0.0, 1.9),
            rotation=(0.0, math.pi / 2.0, 0.0),
        )
        frame = bpy.context.object
        frame.name = "Photon_Loom_Frame_%s" % side
        move_to_collection(frame, export_collection)
        frame.data.materials.append(frame_material)

    fiber_mesh = create_fiber_tube_mesh()
    fibers = bpy.data.objects.new("Photon_Loom_100_Fiber_Weaves", fiber_mesh)
    export_collection.objects.link(fibers)
    fibers.data.materials.append(fiber_material)
    fibers["fiber_count"] = 100
    fibers["vertex_color_gradient"] = "blue-cyan-purple"
    fibers["layout_location"] = "(6, 0, 0)"

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=6,
        radius=0.34,
        depth=0.78,
        location=(6.0, 0.0, 1.9),
    )
    core = bpy.context.object
    core.name = "Photon_Compute_Heart_Prism"
    move_to_collection(core, export_collection)
    core.data.materials.append(core_material)

    # 用多个关键帧逼近正弦曲线，并用 Cycles 完美循环。
    for frame, z_value in ((1, 1.9), (55, 2.16), (110, 1.9), (165, 1.64), (250, 1.9)):
        core.location.z = z_value
        core.keyframe_insert(data_path="location", index=2, frame=frame)
    if core.animation_data and core.animation_data.action:
        for fcurve in iter_action_fcurves(core.animation_data.action):
            for keyframe in fcurve.keyframe_points:
                keyframe.interpolation = "BEZIER"
        add_cycles_modifier(core.animation_data.action)
    core["animation"] = "sine_like_vertical_float"
    core["layout_location"] = "(6, 0, 0)"
    return fibers, core


# -----------------------------------------------------------------------------
# 巨型殿堂扩建：通用几何与呼吸灯材质
# -----------------------------------------------------------------------------


def create_box_mesh(name, size_x, size_y, size_z):
    """创建可被多个对象复用的盒体网格，减少 glTF 的几何数据量。"""
    half_x, half_y, half_z = size_x / 2.0, size_y / 2.0, size_z / 2.0
    vertices = [
        (-half_x, -half_y, -half_z), (half_x, -half_y, -half_z),
        (half_x, half_y, -half_z), (-half_x, half_y, -half_z),
        (-half_x, -half_y, half_z), (half_x, -half_y, half_z),
        (half_x, half_y, half_z), (-half_x, half_y, half_z),
    ]
    faces = [
        (0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
        (1, 5, 6, 2), (2, 6, 7, 3), (4, 0, 3, 7),
    ]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    return mesh


def make_breathing_pbr_material(name, color, phase):
    """创建带相位差的发光 PBR 材质，呼吸由关键帧而非驱动器实现。"""
    material = make_pbr_material(
        name,
        tuple(component * 0.08 for component in color),
        metallic=0.25,
        roughness=0.2,
        emission_color=color,
        emission_strength=1.0,
    )
    principled = find_node(material.node_tree.nodes, "BSDF_PRINCIPLED")
    strength_socket = get_socket(principled, {"Emission Strength", "emission_strength", "发光强度"})
    if strength_socket:
        for frame in (1, 63, 125, 188, 250):
            progress = (frame - 1) / 249.0
            value = 2.0 + 13.0 * (0.5 + 0.5 * math.sin(math.tau * progress + phase))
            strength_socket.default_value = value
            strength_socket.keyframe_insert("default_value", frame=frame)
        if material.node_tree.animation_data:
            add_cycles_modifier(material.node_tree.animation_data.action)
    material["webgl_emission_breath_phase"] = phase
    return material


# -----------------------------------------------------------------------------
# 巨型殿堂扩建：高空参数化数据飞檐
# -----------------------------------------------------------------------------


def create_parametric_data_eaves(dome_collection):
    """生成 36 条飞檐骨架和 500 块共享网格的数字雨玻璃瓦片。"""
    rib_material = make_pbr_material(
        "Data_Eaves_Rib_Metal",
        (0.006, 0.012, 0.02),
        metallic=0.9,
        roughness=0.23,
        emission_color=(0.0, 0.18, 0.32),
        emission_strength=3.0,
    )

    # 将 36 根 Bezier 曲线写入同一个 Curve 数据块，再转换为单一可导出的网格。
    curve_data = bpy.data.curves.new("Parametric_Data_Eaves_Bezier", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 4
    curve_data.bevel_depth = 0.045
    curve_data.bevel_resolution = 1
    for index in range(36):
        angle = math.tau * index / 36.0
        spline = curve_data.splines.new("BEZIER")
        spline.bezier_points.add(2)
        coordinates = (
            (14.0 * math.cos(angle), 14.0 * math.sin(angle), 10.0),
            (5.6 * math.cos(angle), 5.6 * math.sin(angle), 14.15),
            (0.0, 0.0, 15.0),
        )
        for point, coordinate in zip(spline.bezier_points, coordinates):
            point.co = coordinate
            point.handle_left_type = "AUTO"
            point.handle_right_type = "AUTO"

    ribs = bpy.data.objects.new("Parametric_Data_Eaves_36_Bezier_Ribs", curve_data)
    dome_collection.objects.link(ribs)
    curve_data.materials.append(rib_material)
    ribs["source"] = "36 radial Bezier curves"
    bpy.ops.object.select_all(action="DESELECT")
    ribs.select_set(True)
    bpy.context.view_layer.objects.active = ribs
    try:
        bpy.ops.object.convert(target="MESH")
    except Exception:
        pass
    ribs = bpy.context.object
    ribs.name = "Parametric_Data_Eaves_36_Ribs"

    # 数字雨材质：细长 Voronoi 线条 + Mapping Y 轴滚动动画。
    tile_material = bpy.data.materials.new("Dome_Digital_Rain")
    tile_material.use_nodes = True
    tile_material["gltf_export_material"] = "Dome_Digital_Rain_GLTF"
    tile_material["webgl_uv_scroll_y_per_loop"] = -6.0
    set_material_transparency(tile_material)
    make_pbr_material(
        "Dome_Digital_Rain_GLTF",
        (0.004, 0.009, 0.014),
        metallic=0.35,
        roughness=0.17,
        emission_color=(0.0, 0.45, 0.38),
        emission_strength=2.4,
    )
    nodes = tile_material.node_tree.nodes
    links = tile_material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    texcoord = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    voronoi = nodes.new("ShaderNodeTexVoronoi")
    ramp = nodes.new("ShaderNodeValToRGB")
    set_socket(principled, {"Base Color", "base_color", "基础色"}, (0.002, 0.005, 0.009, 1.0))
    set_socket(principled, {"Metallic", "metallic", "金属度"}, 0.55)
    set_socket(principled, {"Roughness", "roughness", "粗糙度"}, 0.18)
    set_socket(principled, {"Alpha", "alpha", "透明度"}, 0.62)
    set_socket(principled, {"Emission Strength", "emission_strength", "发光强度"}, 8.0)
    set_socket(mapping, {"Scale", "scale"}, (1.0, 36.0, 1.0))
    try:
        voronoi.feature = "DISTANCE_TO_EDGE"
    except Exception:
        pass
    set_socket(voronoi, {"Scale", "scale"}, 5.0)
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.0, 0.8, 0.52, 1.0)
    ramp.color_ramp.elements[1].position = 0.018
    ramp.color_ramp.elements[1].color = (0.0, 0.0, 0.0, 1.0)
    links.new(texcoord.outputs["Generated"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], voronoi.inputs["Vector"])
    links.new(voronoi.outputs.get("Distance", voronoi.outputs[0]), ramp.inputs["Fac"])
    emission_input = get_socket(principled, {"Emission Color", "Emission", "emission_color", "发光", "发光颜色"})
    if emission_input:
        links.new(ramp.outputs["Color"], emission_input)
    links.new(principled.outputs[0], output.inputs["Surface"])
    mapping_location = mapping.inputs.get("Location")
    if mapping_location:
        mapping_location.default_value = (0.0, 0.0, 0.0)
        mapping_location.keyframe_insert("default_value", index=1, frame=1)
        mapping_location.default_value[1] = -6.0
        mapping_location.keyframe_insert("default_value", index=1, frame=250)
        if tile_material.node_tree.animation_data:
            add_cycles_modifier(tile_material.node_tree.animation_data.action)

    # 14 圈 x 36 片 = 504 个实例，使用同一份薄盒网格控制导出体积。
    tile_mesh = create_box_mesh("Dome_Glass_Tile_Shared_Mesh", 0.72, 0.5, 0.028)
    tile_mesh.materials.append(tile_material)
    tile_count = 0
    for band in range(14):
        radial = 2.2 + 11.5 * band / 13.0
        for segment in range(36):
            angle = math.tau * segment / 36.0 + (band % 2) * 0.075
            z = 15.0 - 5.0 * (radial / 14.0) ** 1.42
            tile = bpy.data.objects.new("Dome_Rain_Tile_%03d" % tile_count, tile_mesh)
            dome_collection.objects.link(tile)
            tile.location = (radial * math.cos(angle), radial * math.sin(angle), z)
            slope = -(5.0 * 1.42 / 14.0) * (radial / 14.0) ** 0.42
            normal = Vector((-slope * math.cos(angle), -slope * math.sin(angle), 1.0)).normalized()
            tile.rotation_euler = normal.to_track_quat("Z", "Y").to_euler()
            tile["instance_role"] = "dome_digital_rain_tile"
            tile_count += 1

    return ribs, tile_count


# -----------------------------------------------------------------------------
# 巨型殿堂扩建：算力斗拱图腾巨柱
# -----------------------------------------------------------------------------


def create_compute_bracket_pillars(pillar_collection):
    """创建四根 15m 巨柱和每柱 40 个交错斗拱模块。"""
    pillar_material = make_pbr_material(
        "Pillar_Dark_Brushed_Metal",
        (0.012, 0.014, 0.02),
        metallic=1.0,
        roughness=0.28,
    )
    orange_materials = [
        make_breathing_pbr_material("Dougong_Orange_Breath_%d" % index, (1.0, 0.09, 0.01), index * 0.85)
        for index in range(4)
    ]
    blue_materials = [
        make_breathing_pbr_material("Dougong_Blue_Breath_%d" % index, (0.0, 0.32, 1.0), 0.45 + index * 0.85)
        for index in range(4)
    ]
    block_material = make_pbr_material(
        "Dougong_Black_Module",
        (0.006, 0.008, 0.012),
        metallic=0.86,
        roughness=0.24,
    )
    module_meshes = {
        "black": create_box_mesh("Dougong_Black_Shared_Mesh", 1.2, 0.46, 0.28),
    }
    module_meshes["black"].materials.append(block_material)
    for phase_index in range(4):
        orange_key = "orange_%d" % phase_index
        blue_key = "blue_%d" % phase_index
        module_meshes[orange_key] = create_box_mesh("Dougong_Orange_Shared_Mesh_%d" % phase_index, 1.2, 0.46, 0.28)
        module_meshes[blue_key] = create_box_mesh("Dougong_Blue_Shared_Mesh_%d" % phase_index, 1.2, 0.46, 0.28)
        module_meshes[orange_key].materials.append(orange_materials[phase_index])
        module_meshes[blue_key].materials.append(blue_materials[phase_index])
    column_locations = ((15.0, 15.0), (-15.0, 15.0), (-15.0, -15.0), (15.0, -15.0))
    total_modules = 0

    for column_index, (x, y) in enumerate(column_locations):
        bpy.ops.mesh.primitive_cube_add(location=(x, y, 7.5))
        pillar = bpy.context.object
        pillar.name = "Compute_Totem_Pillar_%02d" % column_index
        move_to_collection(pillar, pillar_collection)
        pillar.scale = (0.7, 0.7, 7.5)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        pillar.data.materials.append(pillar_material)
        bevel = pillar.modifiers.new("Pillar_Bevel_Applied", "BEVEL")
        bevel.width = 0.12
        bevel.segments = 3
        bpy.context.view_layer.objects.active = pillar
        try:
            bpy.ops.object.modifier_apply(modifier=bevel.name)
        except Exception:
            pass
        pillar["layout_location"] = "(%s, %s, 0)" % (x, y)

        # 每层八向交错悬挑，五层共 40 块，形成斗拱/服务器机柜混合轮廓。
        for level in range(5):
            height = 8.25 + level * 0.78
            for arm in range(8):
                angle = math.tau * arm / 8.0 + (level % 2) * math.pi / 8.0
                radial = 0.95 + (level % 2) * 0.18
                if (arm + level) % 3 == 0:
                    mesh_key = "orange_%d" % ((arm + column_index) % 4)
                    channel = "orange"
                elif (arm + level) % 3 == 1:
                    mesh_key = "blue_%d" % ((arm + column_index) % 4)
                    channel = "blue"
                else:
                    mesh_key = "black"
                    channel = "black"
                module = bpy.data.objects.new(
                    "Dougong_%02d_%02d_%02d" % (column_index, level, arm), module_meshes[mesh_key]
                )
                pillar_collection.objects.link(module)
                module.location = (x + radial * math.cos(angle), y + radial * math.sin(angle), height)
                module.rotation_euler = (0.0, 0.0, angle)
                module.scale = (1.0 - level * 0.07, 1.0, 1.0)
                module["breath_channel"] = channel
                total_modules += 1

    return len(column_locations), total_modules


# -----------------------------------------------------------------------------
# 巨型殿堂扩建：量子荷花矩阵
# -----------------------------------------------------------------------------


def create_lotus_mesh(name):
    """由六个低模三角花瓣组成一朵可共享的机械荷花网格。"""
    vertices = []
    faces = []
    for petal in range(6):
        angle = math.tau * petal / 6.0
        left_angle = angle - 0.38
        right_angle = angle + 0.38
        start = len(vertices)
        vertices.extend([
            (0.0, 0.0, 0.05),
            (0.34 * math.cos(left_angle), 0.34 * math.sin(left_angle), 0.0),
            (0.34 * math.cos(right_angle), 0.34 * math.sin(right_angle), 0.0),
            (0.54 * math.cos(angle), 0.54 * math.sin(angle), 0.12),
        ])
        faces.extend([(start, start + 1, start + 3), (start, start + 3, start + 2)])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    return mesh


def create_quantum_lotus_matrix(lotus_collection):
    """生成环形镜面荷塘与 200 朵按 Fibonacci 螺旋布局的低模荷花。"""
    mirror_material = make_pbr_material(
        "Quantum_Lotus_Dark_Mirror",
        (0.003, 0.006, 0.011),
        metallic=0.95,
        roughness=0.05,
    )
    petal_materials = []
    for name, color in (("Lotus_Petal_Pink", (1.0, 0.03, 0.38)), ("Lotus_Petal_Cyan", (0.0, 0.7, 1.0))):
        material = make_pbr_material(name, tuple(component * 0.12 for component in color), metallic=0.08,
                                     roughness=0.2, emission_color=color, emission_strength=7.0)
        set_material_transparency(material)
        shader = find_node(material.node_tree.nodes, "BSDF_PRINCIPLED")
        set_socket(shader, {"Alpha", "alpha", "透明度"}, 0.72)
        petal_materials.append(material)

    # 环形镜面：半径 4m 到 8m，不使用布尔或未应用修改器。
    segments = 128
    vertices = []
    faces = []
    for index in range(segments):
        angle = math.tau * index / segments
        vertices.append((4.0 * math.cos(angle), 4.0 * math.sin(angle), -0.05))
        vertices.append((8.0 * math.cos(angle), 8.0 * math.sin(angle), -0.05))
    for index in range(segments):
        a = index * 2
        b = (index * 2 + 2) % (segments * 2)
        faces.append((a, b, b + 1, a + 1))
    pond_mesh = bpy.data.meshes.new("Quantum_Lotus_Annular_Mirror_Mesh")
    pond_mesh.from_pydata(vertices, [], faces)
    pond_mesh.update()
    pond = bpy.data.objects.new("Quantum_Lotus_Annular_Mirror", pond_mesh)
    lotus_collection.objects.link(pond)
    pond.data.materials.append(mirror_material)

    pink_mesh = create_lotus_mesh("Quantum_Lotus_Pink_Shared_Mesh")
    cyan_mesh = create_lotus_mesh("Quantum_Lotus_Cyan_Shared_Mesh")
    pink_mesh.materials.append(petal_materials[0])
    cyan_mesh.materials.append(petal_materials[1])
    golden_angle = math.pi * (3.0 - math.sqrt(5.0))
    lotus_count = 200
    for index in range(lotus_count):
        ratio = (index + 0.5) / lotus_count
        radius = math.sqrt(4.0 ** 2 + ratio * (8.0 ** 2 - 4.0 ** 2))
        angle = index * golden_angle
        x, y = radius * math.cos(angle), radius * math.sin(angle)
        lotus = bpy.data.objects.new("Quantum_Lotus_%03d" % index, pink_mesh if index % 2 == 0 else cyan_mesh)
        lotus_collection.objects.link(lotus)
        lotus.location = (x, y, 0.045)
        scale = 0.72 + 0.38 * ((index * 17) % 11) / 10.0
        lotus.scale = (scale, scale, scale)
        phase = 0.55 * x + 0.38 * y
        # 五个关键帧近似正弦起伏，首尾值严格相同，方便循环。
        for frame in (1, 63, 125, 188, 250):
            progress = (frame - 1) / 249.0
            lotus.location.z = 0.045 + 0.13 * math.sin(math.tau * progress + phase)
            lotus.keyframe_insert(data_path="location", index=2, frame=frame)
        if lotus.animation_data:
            add_cycles_modifier(lotus.animation_data.action)
        lotus["phase_shift"] = phase
        lotus["gltf_animated"] = True

    return pond, lotus_count


# -----------------------------------------------------------------------------
# 巨型殿堂扩建：曲率引擎月洞门
# -----------------------------------------------------------------------------


def animate_portal_ring(obj, rotation_y, rotation_z):
    """按给定的 Y/Z 关键帧序列为月洞门圆环写入可循环机械旋转。"""
    for frame, y_value, z_value in zip((1, 63, 125, 188, 250), rotation_y, rotation_z):
        obj.rotation_euler[1] = y_value
        obj.rotation_euler[2] = z_value
        obj.keyframe_insert(data_path="rotation_euler", index=1, frame=frame)
        obj.keyframe_insert(data_path="rotation_euler", index=2, frame=frame)
    if obj.animation_data:
        add_cycles_modifier(obj.animation_data.action)


def create_curvature_moon_gate(entrance_collection):
    """创建 (0, -18, 0) 三层嵌套月洞门及其机械旋转关键帧。"""
    materials = (
        make_pbr_material("Moon_Gate_Outer_Black_Metal", (0.006, 0.009, 0.014), metallic=1.0, roughness=0.22),
        make_pbr_material("Moon_Gate_Middle_White_Glow", (0.55, 0.62, 0.72), metallic=0.12, roughness=0.16,
                          emission_color=(0.82, 0.95, 1.0), emission_strength=25.0),
        make_pbr_material("Moon_Gate_Inner_Gold_Glow", (0.28, 0.05, 0.006), metallic=0.45, roughness=0.16,
                          emission_color=(1.0, 0.16, 0.01), emission_strength=28.0),
    )
    specifications = (
        ("Moon_Gate_Outer_Ring", 4.0, 0.13, materials[0], (0.14, -0.10, 0.0, 0.10, 0.0),
         (0.0, 0.05, 0.0, -0.05, 0.0)),
        ("Moon_Gate_Middle_Ring", 3.5, 0.09, materials[1], (0.0, 0.0, 0.0, 0.0, 0.0),
         (0.0, math.pi, math.tau, 3.0 * math.pi, 4.0 * math.pi)),
        ("Moon_Gate_Inner_Ring", 3.0, 0.075, materials[2], (0.18, -0.18, 0.18, -0.18, 0.18),
         (0.0, -3.0 * math.pi, -6.0 * math.pi, -9.0 * math.pi, -12.0 * math.pi)),
    )
    rings = []
    for name, radius, tube_radius, material, y_keys, z_keys in specifications:
        bpy.ops.mesh.primitive_torus_add(
            major_radius=radius,
            minor_radius=tube_radius,
            major_segments=128,
            minor_segments=16,
            location=(0.0, -18.0, 4.0),
            rotation=(math.pi / 2.0, 0.0, 0.0),
        )
        ring = bpy.context.object
        ring.name = name
        move_to_collection(ring, entrance_collection)
        ring.data.materials.append(material)
        animate_portal_ring(ring, y_keys, z_keys)
        ring["layout_location"] = "(0, -18, 0)"
        ring["webgl_loop"] = True
        rings.append(ring)
    return rings


# -----------------------------------------------------------------------------
# glTF 导出辅助
# -----------------------------------------------------------------------------


def gltf_export_objects():
    """汇总静态展件和数据动画集合，保留网格与 Empty 父级动画。"""
    objects = []
    seen = set()
    for collection_name in (
        GLTF_COLLECTION,
        DATA_COLLECTION,
        DOME_COLLECTION,
        PILLAR_COLLECTION,
        LOTUS_COLLECTION,
        ENTRANCE_COLLECTION,
    ):
        collection = bpy.data.collections.get(collection_name)
        if not collection:
            continue
        for obj in collection.all_objects:
            if obj.type not in {"MESH", "EMPTY"} or obj.name in seen:
                continue
            seen.add(obj.name)
            objects.append(obj)
    return objects


def prepare_gltf_materials():
    """把复杂的全息预览材质临时替换为 Principled PBR 材质。"""
    if not bpy.data.collections.get(GLTF_COLLECTION):
        return []
    replacements = []
    for obj in gltf_export_objects():
        for slot_index, slot in enumerate(obj.material_slots):
            material = slot.material
            if material is None:
                continue
            export_name = material.get("gltf_export_material")
            export_material = bpy.data.materials.get(export_name) if export_name else None
            if export_material and export_material != material:
                replacements.append((obj, slot_index, material))
                slot.material = export_material
    return replacements


def restore_preview_materials(replacements):
    """恢复 Blender 中的全息节点材质。"""
    for obj, slot_index, material in replacements:
        if slot_index < len(obj.material_slots):
            obj.material_slots[slot_index].material = material


def export_gltf(filepath):
    """导出仅包含网格、材质和关键帧的 GLB，不导出体积雾和灯光。"""
    export_collection = bpy.data.collections.get(GLTF_COLLECTION)
    if not export_collection:
        raise RuntimeError("找不到 WUZHEN_GLTF_EXPORT 集合")

    replacements = prepare_gltf_materials()
    previous_selection = list(bpy.context.selected_objects)
    previous_active = bpy.context.view_layer.objects.active

    try:
        bpy.ops.object.select_all(action="DESELECT")
        export_objects = gltf_export_objects()
        for obj in export_objects:
            obj.select_set(True)
        if export_objects:
            bpy.context.view_layer.objects.active = export_objects[0]

        # 使用稳定的核心参数，避免不同 Blender 版本的可选参数差异。
        bpy.ops.export_scene.gltf(
            filepath=filepath,
            export_format="GLB",
            use_selection=True,
            export_animations=True,
            export_lights=False,
            export_cameras=False,
        )
        print("glTF export complete:", filepath)
    finally:
        restore_preview_materials(replacements)
        bpy.ops.object.select_all(action="DESELECT")
        for obj in previous_selection:
            if obj and obj.name in bpy.data.objects:
                obj.select_set(True)
        if previous_active and previous_active.name in bpy.data.objects:
            bpy.context.view_layer.objects.active = previous_active


# -----------------------------------------------------------------------------
# 主流程：一键执行
# -----------------------------------------------------------------------------


def build_scene():
    (scene, export_collection, environment_collection, data_collection,
     dome_collection, pillar_collection, lotus_collection, entrance_collection) = clear_scene()
    floor = create_circuit_floor(export_collection)
    waterfall = create_data_waterfall(export_collection)
    create_pedestal(export_collection)
    terrain = create_terrain(export_collection)
    bridge = create_arch_bridge(export_collection)
    shard_count = create_double_helix(data_collection)
    awaken_rig, awaken_panels = create_awaken_chamber(export_collection, data_collection)
    fibers, compute_core = create_photon_loom(export_collection)
    dome_ribs, dome_tile_count = create_parametric_data_eaves(dome_collection)
    pillar_count, dougong_module_count = create_compute_bracket_pillars(pillar_collection)
    lotus_pond, lotus_count = create_quantum_lotus_matrix(lotus_collection)
    entrance_rings = create_curvature_moon_gate(entrance_collection)
    uplight, fog_box, camera = create_environment(environment_collection, export_collection)

    # 记录关键规格，便于后续自动化检查和 WebGL 管线读取。
    scene["project"] = "Future Wuzhen / Cyber Water Town Hologram"
    scene["terrain_radius_m"] = 2.8
    scene["terrain_height_m"] = 0.9
    scene["terrain_subdivision_cuts"] = 150
    scene["particle_system_used"] = False
    scene["data_shard_count"] = shard_count
    scene["gltf_export_collection"] = GLTF_COLLECTION
    scene["animation_range"] = "1-250 / cyclic"
    scene["exhibition_floor"] = floor.name
    scene["data_waterfall"] = waterfall.name
    scene["awaken_chamber_rig"] = awaken_rig.name
    scene["awaken_panel_count"] = len(awaken_panels)
    scene["photon_fiber_count"] = 100
    scene["photon_compute_core"] = compute_core.name
    scene["layout"] = "center=sandbox; rear=(0,8,0); left=(-6,0,0); right=(6,0,0)"
    scene["dome_ribs"] = 36
    scene["dome_tiles"] = dome_tile_count
    scene["corner_pillars"] = pillar_count
    scene["dougong_modules"] = dougong_module_count
    scene["quantum_lotus_count"] = lotus_count
    scene["entrance_rings"] = len(entrance_rings)

    scene.frame_set(1)
    bpy.ops.object.select_all(action="DESELECT")
    print("Future Wuzhen sandbox generated successfully")
    print("Terrain:", terrain.name)
    print("Bridge:", bridge.name)
    print("Animated data shards:", shard_count)
    print("Circuit floor:", floor.name)
    print("Data waterfall:", waterfall.name)
    print("Awaken panels:", len(awaken_panels))
    print("Photon fibers: 100")
    print("Dome tiles:", dome_tile_count)
    print("Dougong modules:", dougong_module_count)
    print("Quantum lotuses:", lotus_count)
    print("Moon gate rings:", len(entrance_rings))
    print("glTF collection:", GLTF_COLLECTION)
    return scene


build_scene()
