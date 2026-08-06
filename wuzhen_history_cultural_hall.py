"""
乌镇历史文化馆：环形藏书阁、室内水乡、岁月长卷、神圣档案。

运行本脚本会新建/重建独立场景 Wuzhen_History_Cultural_Hall，
不会清空已有的 Future Wuzhen 场景。

交互约定：
- Interactive_Letter_MaoDun
- Interactive_Letter_History
- Interactive_Letter_WuzhenArchive
前端可直接按 Interactive_ 前缀筛选可点击信件。
"""

import math
import bmesh
import bpy
from mathutils import Vector


SCENE_NAME = "Wuzhen_History_Cultural_Hall"
ROOT_COLLECTION = "HISTORY_HALL_ROOT"
SCROLL_COLLECTION = "HISTORY_SCROLL_AND_LETTERS"
CANAL_COLLECTION = "HISTORY_CANAL_AND_PLATFORM"
ARCHIVE_COLLECTION = "HISTORY_CIRCULAR_ARCHIVE"
DOME_COLLECTION = "HISTORY_GEODESIC_DOME"


def socket(node, aliases):
    """按 identifier/name 读取节点插槽，兼容中文 Blender 界面。"""
    for item in node.inputs:
        if item.identifier in aliases or item.name in aliases:
            return item
    return None


def set_socket(node, aliases, value):
    item = socket(node, aliases)
    if item:
        item.default_value = value
    return item


def find_principled(material):
    return next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)


def set_transparent(material):
    try:
        material.surface_render_method = "DITHERED"
    except Exception:
        try:
            material.blend_method = "BLEND"
        except Exception:
            pass


def make_pbr(name, base, metallic=0.0, roughness=0.4, emission=None, emission_strength=0.0, alpha=1.0):
    """创建 glTF 友好的 Principled 材质；发光使用标准 Emission 输入。"""
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    set_socket(shader, {"Base Color", "base_color", "基础色"}, (*base, 1.0))
    set_socket(shader, {"Metallic", "metallic", "金属度"}, metallic)
    set_socket(shader, {"Roughness", "roughness", "粗糙度"}, roughness)
    set_socket(shader, {"Alpha", "alpha", "透明度"}, alpha)
    if emission:
        set_socket(shader, {"Emission", "Emission Color", "emission_color", "发光", "发光颜色"}, (*emission, 1.0))
        set_socket(shader, {"Emission Strength", "emission_strength", "发光强度"}, emission_strength)
    links.new(shader.outputs[0], output.inputs["Surface"])
    if alpha < 1.0:
        set_transparent(material)
    material["history_hall_asset"] = True
    return material


def fcurves(action):
    """兼容 Blender 3.x-5.2 的 Action 曲线容器。"""
    if not action:
        return []
    if hasattr(action, "fcurves"):
        return list(action.fcurves)
    result = []
    for layer in getattr(action, "layers", []):
        for strip in getattr(layer, "strips", []):
            for slot_data in getattr(action, "slots", []):
                try:
                    result.extend(list(strip.channelbag(slot_data).fcurves))
                except Exception:
                    pass
    return result


def loop_animation(action, interpolation="LINEAR"):
    """将关键帧改为循环播放。首尾值由调用者保持一致，glTF 可直接播放。"""
    for curve in fcurves(action):
        for point in curve.keyframe_points:
            point.interpolation = interpolation
        if not any(modifier.type == "CYCLES" for modifier in curve.modifiers):
            curve.modifiers.new(type="CYCLES")


def move_to(obj, collection):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    collection.objects.link(obj)


def create_box_mesh(name, x, y, z):
    hx, hy, hz = x / 2.0, y / 2.0, z / 2.0
    vertices = [(-hx,-hy,-hz),(hx,-hy,-hz),(hx,hy,-hz),(-hx,hy,-hz),
                (-hx,-hy,hz),(hx,-hy,hz),(hx,hy,hz),(-hx,hy,hz)]
    faces = [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(4,0,3,7)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    return mesh


def annulus_mesh(name, inner_radius, outer_radius, z, segments=128):
    vertices, faces = [], []
    for index in range(segments):
        angle = math.tau * index / segments
        vertices.extend(((inner_radius * math.cos(angle), inner_radius * math.sin(angle), z),
                         (outer_radius * math.cos(angle), outer_radius * math.sin(angle), z)))
    for index in range(segments):
        a = index * 2
        b = (a + 2) % (segments * 2)
        faces.append((a, b, b + 1, a + 1))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    return mesh


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def prepare_scene():
    """新建或重建历史馆独立 Scene，只删除该场景自己的对象与集合。"""
    scene = bpy.data.scenes.get(SCENE_NAME)
    if scene is None:
        scene = bpy.data.scenes.new(SCENE_NAME)
    bpy.context.window.scene = scene

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(scene.collection.children):
        scene.collection.children.unlink(collection)
        if collection.users == 0:
            bpy.data.collections.remove(collection)

    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.frame_start, scene.frame_end = 1, 250
    engine_ids = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engine_ids else "BLENDER_EEVEE"
    world = bpy.data.worlds.get("History_Hall_World") or bpy.data.worlds.new("History_Hall_World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background") or next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (0.002, 0.004, 0.015, 1.0)
    bg.inputs["Strength"].default_value = 0.04

    root = bpy.data.collections.new(ROOT_COLLECTION)
    scene.collection.children.link(root)
    collections = {}
    for name in (SCROLL_COLLECTION, CANAL_COLLECTION, ARCHIVE_COLLECTION, DOME_COLLECTION):
        collection = bpy.data.collections.new(name)
        root.children.link(collection)
        collections[name] = collection
    return scene, collections


# -----------------------------------------------------------------------------
# 1. 岁月螺旋长卷与交互飞页
# -----------------------------------------------------------------------------


def create_scroll_ribbon(collection):
    """用 UV 完整的参数化四边形带生成从 Z=2 到 Z=12 的螺旋长卷。"""
    parchment = make_pbr("Luminous_Parchment", (0.34, 0.13, 0.025), metallic=0.22, roughness=0.34,
                         emission=(1.0, 0.26, 0.035), emission_strength=4.8)
    # 参考图中的档案带更宽、更从容，作为空间的单一视觉轴线。
    segments, width = 180, 2.05
    vertices, faces, uv_values = [], [], []
    for index in range(segments + 1):
        t = index / segments
        angle = math.tau * (0.18 + 2.3 * t)
        radius = 1.7 + 0.85 * t
        center = Vector((radius * math.cos(angle), radius * math.sin(angle), 2.25 + 8.6 * t))
        radial = Vector((math.cos(angle), math.sin(angle), 0.0))
        for sign in (-1.0, 1.0):
            position = center + radial * sign * width / 2.0
            vertices.append(tuple(position))
            uv_values.append((t, 0.0 if sign < 0 else 1.0))
    for index in range(segments):
        a = index * 2
        faces.append((a, a + 1, a + 3, a + 2))
    mesh = bpy.data.meshes.new("Spiral_Scroll_UV_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="HistoryContentUV")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            uv_layer.data[loop_index].uv = uv_values[vertex_index]
    scroll = bpy.data.objects.new("Spiral_Scroll_History_Content", mesh)
    collection.objects.link(scroll)
    mesh.materials.append(parchment)
    scroll["front_end_uv_slot"] = "HistoryContentUV"
    scroll["front_end_role"] = "replaceable_history_scroll"
    return scroll


def create_page_mesh(name, width=0.62, height=0.86):
    """三列弯曲纸张，低模但有纸页起伏轮廓。"""
    vertices = []
    for x in (-width / 2.0, 0.0, width / 2.0):
        bend = 0.08 * (1.0 - abs(x) / (width / 2.0))
        vertices.extend(((x, 0.0, -height / 2.0), (x, bend, height / 2.0)))
    faces = [(0, 2, 3, 1), (2, 4, 5, 3)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    return mesh


def animate_flying_page(page, base_location, base_rotation, phase, amplitude=0.38, frames=(1,63,125,188,250)):
    """对位置与旋转写入正弦关键帧，首尾闭合。"""
    for frame in frames:
        t = (frame - 1) / 249.0
        wave = math.tau * t + phase
        page.location = (base_location[0] + amplitude * math.sin(wave),
                         base_location[1] + amplitude * math.cos(wave * 1.2),
                         base_location[2] + amplitude * 0.65 * math.sin(wave * 1.5))
        page.rotation_euler = (base_rotation[0] + 0.35 * math.sin(wave),
                               base_rotation[1] + 0.25 * math.cos(wave * 1.3),
                               base_rotation[2] + 0.5 * math.sin(wave * 0.8))
        page.keyframe_insert(data_path="location", frame=frame)
        page.keyframe_insert(data_path="rotation_euler", frame=frame)
    loop_animation(page.animation_data.action if page.animation_data else None)


def create_scroll_and_letters(collection):
    scroll = create_scroll_ribbon(collection)
    page_material = make_pbr("Archive_Paper_Warm", (0.55, 0.32, 0.11), metallic=0.0, roughness=0.58,
                             emission=(0.75, 0.22, 0.03), emission_strength=1.0, alpha=0.86)
    page_mesh = create_page_mesh("Flying_Page_Shared_Mesh")
    page_mesh.materials.append(page_material)
    # 控制飞页数量，形成点缀而不遮蔽长卷与历史画屏。
    for index in range(42):
        phase = math.tau * index / 42.0
        height = 1.4 + 9.0 * ((index * 17) % 41) / 41.0
        radius = 3.0 + 1.6 * ((index * 11) % 37) / 37.0
        page = bpy.data.objects.new("Archive_Flying_Page_%03d" % index, page_mesh)
        collection.objects.link(page)
        base = (radius * math.cos(phase), radius * math.sin(phase), height)
        page.scale = (0.72 + 0.28 * ((index * 13) % 9) / 8.0,) * 3
        animate_flying_page(page, base, (0.2 * math.sin(phase), 0.15, phase + math.pi / 2.0), phase, 0.15)

    # 三封前端交互信件：名称、位置和自定义属性均固定，便于 Raycaster 筛选。
    gold = make_pbr("Interactive_Letter_Gold_Edge", (0.25, 0.08, 0.008), metallic=0.45, roughness=0.16,
                    emission=(1.0, 0.32, 0.015), emission_strength=18.0)
    letter_mesh = create_page_mesh("Interactive_Letter_Shared_Mesh", 1.2, 1.55)
    letter_mesh.materials.append(gold)
    frame_mesh = create_box_mesh("Interactive_Letter_Frame_Shared_Mesh", 1.28, 0.04, 1.62)
    frame_mesh.materials.append(gold)
    specs = (
        ("Interactive_Letter_MaoDun", (-2.5, -4.6, 1.65), 0.0),
        ("Interactive_Letter_History", (0.0, -4.15, 2.05), 1.8),
        ("Interactive_Letter_WuzhenArchive", (2.5, -4.6, 1.65), 3.6),
    )
    letters = []
    for name, location, phase in specs:
        letter = bpy.data.objects.new(name, letter_mesh)
        collection.objects.link(letter)
        letter.location = location
        letter.rotation_euler = (math.pi / 2.0, 0.0, 0.0)
        letter["interactive"] = True
        letter["interaction_type"] = "history_archive_letter"
        letter["raycast_target"] = name
        frame = bpy.data.objects.new(name + "_Gold_Frame", frame_mesh)
        collection.objects.link(frame)
        frame.parent = letter
        frame.location = (0.0, -0.03, 0.0)
        for frame_number in (1, 125, 250):
            t = (frame_number - 1) / 249.0
            letter.location.z = location[2] + 0.18 * math.sin(math.tau * t + phase)
            letter.keyframe_insert(data_path="location", index=2, frame=frame_number)
        loop_animation(letter.animation_data.action if letter.animation_data else None, "BEZIER")
        letters.append(letter)
    return scroll, letters


# -----------------------------------------------------------------------------
# 2. 多层原点展台、室内运河、古桥和乌篷船
# -----------------------------------------------------------------------------


def create_arch_mesh(name, major=2.0, tube=0.12, center_z=0.0):
    vertices, faces = [], []
    arc_steps, tube_steps = 24, 8
    for i in range(arc_steps + 1):
        theta = math.pi * i / arc_steps
        for j in range(tube_steps):
            phi = math.tau * j / tube_steps
            radial = major + tube * math.cos(phi)
            vertices.append((radial * math.cos(theta), tube * math.sin(phi), center_z + radial * math.sin(theta)))
    for i in range(arc_steps):
        for j in range(tube_steps):
            a = i * tube_steps + j
            b = i * tube_steps + (j + 1) % tube_steps
            c = (i + 1) * tube_steps + (j + 1) % tube_steps
            d = (i + 1) * tube_steps + j
            faces.append((a,b,c,d))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    return mesh


def create_canal_and_platform(collection):
    black_metal = make_pbr("Origin_Black_Metal", (0.006,0.009,0.016), metallic=0.95, roughness=0.22)
    blue = make_pbr("Origin_Tech_Blue", (0.0,0.08,0.18), metallic=0.15, roughness=0.2,
                    emission=(0.0,0.48,1.0), emission_strength=14.0)
    water = make_pbr("Indoor_Canal_Mirror_Water", (0.002,0.008,0.022), metallic=0.95, roughness=0.03,
                     emission=(0.0,0.04,0.16), emission_strength=0.8)
    stone = make_pbr("Wuzhen_Stone_Bridge", (0.34,0.31,0.26), metallic=0.05, roughness=0.72)
    lantern = make_pbr("Boat_Warm_Lantern", (0.38,0.06,0.008), metallic=0.1, roughness=0.24,
                       emission=(1.0,0.25,0.015), emission_strength=16.0)

    # 三层阶梯圆台与三道蓝色同心环。
    for level, (radius, z) in enumerate(((3.2,0.18),(2.55,0.42),(1.85,0.64))):
        bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=radius, depth=0.22, location=(0,0,z))
        platform = bpy.context.object
        platform.name = "Temporal_Origin_Platform_%d" % level
        move_to(platform, collection)
        platform.data.materials.append(black_metal)
    for index, radius in enumerate((1.15, 1.65, 2.25)):
        bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=0.032, major_segments=96, minor_segments=10,
                                         location=(0,0,0.78))
        ring = bpy.context.object
        ring.name = "Temporal_Origin_Blue_Ring_%d" % index
        move_to(ring, collection)
        ring.data.materials.append(blue)

    # 参考图为左右两条下沉室内水道，中轴保留仪式性的金色通道。
    canal_mesh = create_box_mesh("Indoor_Canal_Water_Shared_Mesh", 4.4, 17.0, 0.08)
    canal_mesh.materials.append(water)
    for side in (-1, 1):
        canal = bpy.data.objects.new("Indoor_Canal_%s" % ("Left" if side < 0 else "Right"), canal_mesh)
        collection.objects.link(canal)
        canal.location = (side * 6.9, 0.0, -1.82)
        for edge_x in (-2.28, 2.28):
            edge_mesh = create_box_mesh("Canal_Edge_%s_%.1f" % (side, edge_x), 0.16, 17.2, 0.28)
            edge_mesh.materials.append(stone)
            edge = bpy.data.objects.new("Canal_Stone_Edge_%s_%.1f" % (side, edge_x), edge_mesh)
            collection.objects.link(edge)
            edge.location = (side * 6.9 + edge_x, 0.0, -1.68)

    # 中轴台阶由十层低矮阶梯组成，连接玩家入口与时间原点。
    for step in range(10):
        width = 7.6 - step * 0.34
        depth = 1.05
        step_mesh = create_box_mesh("Central_Archive_Step_%02d_Mesh" % step, width, depth, 0.18)
        step_mesh.materials.append(black_metal if step % 2 else stone)
        stair = bpy.data.objects.new("Central_Archive_Step_%02d" % step, step_mesh)
        collection.objects.link(stair)
        stair.location = (0.0, -5.4 + step * 0.48, -0.55 + step * 0.14)

    bridge_mesh = create_arch_mesh("Wuzhen_Stone_Arch_Shared_Mesh", 1.55, 0.16, -1.7)
    bridge_mesh.materials.append(stone)
    for index, y in enumerate((-5.2, 5.2)):
        bridge = bpy.data.objects.new("Indoor_Canal_Stone_Bridge_%d" % index, bridge_mesh)
        collection.objects.link(bridge)
        bridge.location = (0.0, y, -0.05)
        bridge.rotation_euler[2] = math.pi / 2.0

    # 极简乌篷船：低模船体、顶棚和暖色灯笼。
    hull_mesh = create_box_mesh("Wupeng_Boat_Hull_Mesh", 2.1, 0.72, 0.28)
    hull_mesh.materials.append(black_metal)
    boat = bpy.data.objects.new("Wupeng_Boat", hull_mesh)
    collection.objects.link(boat)
    boat.location = (6.9, -2.5, -1.62)
    boat.rotation_euler[2] = math.pi / 2.0
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.38, depth=1.2, location=(6.9,-2.5,-1.22), rotation=(0,math.pi/2,0))
    canopy = bpy.context.object
    canopy.name = "Wupeng_Boat_Canopy"
    move_to(canopy, collection)
    canopy.data.materials.append(black_metal)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.13, location=(7.92,-2.5,-1.28))
    lamp = bpy.context.object
    lamp.name = "Wupeng_Boat_Warm_Lantern"
    move_to(lamp, collection)
    lamp.data.materials.append(lantern)
    for frame, z in ((1,-1.28),(125,-1.17),(250,-1.28)):
        lamp.location.z = z
        lamp.keyframe_insert(data_path="location", index=2, frame=frame)
    loop_animation(lamp.animation_data.action if lamp.animation_data else None, "BEZIER")
    return boat


# -----------------------------------------------------------------------------
# 3. 环形藏书阁幕墙
# -----------------------------------------------------------------------------


def create_archive_galleries(collection):
    wood = make_pbr("Archive_Dark_Wood", (0.045,0.016,0.008), metallic=0.15, roughness=0.42)
    rail = make_pbr("Archive_Blue_Glass_Rail", (0.006,0.06,0.14), metallic=0.12, roughness=0.16,
                    emission=(0.0,0.22,0.8), emission_strength=4.0, alpha=0.5)
    warm = make_pbr("Historical_Frame_Warm_Backlight", (0.35,0.14,0.025), metallic=0.12, roughness=0.28,
                    emission=(1.0,0.24,0.03), emission_strength=8.0)
    book = make_pbr("Archive_Book_Spines", (0.16,0.06,0.018), metallic=0.0, roughness=0.58)
    niche = make_pbr("Archive_Niche_Stone", (0.06,0.035,0.02), metallic=0.08, roughness=0.6)

    # 两层环形画廊地板与发光玻璃护栏。
    for level, z in enumerate((0.1, 5.0)):
        floor_mesh = annulus_mesh("Archive_Gallery_Ring_%d_Mesh" % level, 11.0, 14.0, z)
        floor = bpy.data.objects.new("Archive_Gallery_Ring_%d" % level, floor_mesh)
        collection.objects.link(floor)
        floor_mesh.materials.append(wood)
        for radius in (11.05, 13.95):
            bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=0.035, major_segments=128, minor_segments=10,
                                             location=(0,0,z+0.85))
            guard = bpy.context.object
            guard.name = "Archive_Glass_Rail_%d_%.1f" % (level, radius)
            move_to(guard, collection)
            guard.data.materials.append(rail)

    frame_mesh = create_box_mesh("History_Frame_Shared_Mesh", 4.45, 0.16, 2.75)
    frame_mesh.materials.append(warm)
    panel_material = make_pbr("History_Parchment_Panel", (0.48,0.25,0.08), metallic=0.0, roughness=0.5,
                              emission=(0.9,0.28,0.045), emission_strength=2.8)
    panel_mesh = create_box_mesh("History_Parchment_Panel_Shared_Mesh", 3.95, 0.07, 2.25)
    panel_mesh.materials.append(panel_material)
    niche_mesh = create_box_mesh("Archive_Niche_Shared_Mesh", 2.1, 0.48, 3.0)
    niche_mesh.materials.append(niche)
    book_mesh = create_box_mesh("Archive_Book_Shared_Mesh", 0.18, 0.27, 0.65)
    book_mesh.materials.append(book)
    for index in range(8):
        angle = math.tau * index / 8.0
        tangent = angle + math.pi / 2.0
        # 画框位于外墙，略微朝向内侧。
        frame = bpy.data.objects.new("Historical_Widescreen_Frame_%02d" % index, frame_mesh)
        collection.objects.link(frame)
        frame.location = (15.0 * math.cos(angle), 15.0 * math.sin(angle), 3.0)
        frame.rotation_euler = (0.0, 0.0, tangent)
        frame["front_end_role"] = "historical_widescreen_canvas"
        panel = bpy.data.objects.new("Historical_Illuminated_Panel_%02d" % index, panel_mesh)
        collection.objects.link(panel)
        panel.location = (14.88 * math.cos(angle), 14.88 * math.sin(angle), 3.0)
        panel.rotation_euler = (0.0, 0.0, tangent)
        # 相邻的壁龛与书籍。
        niche_angle = angle + math.pi / 8.0
        alcove = bpy.data.objects.new("Archive_Arched_Niche_%02d" % index, niche_mesh)
        collection.objects.link(alcove)
        alcove.location = (14.65 * math.cos(niche_angle), 14.65 * math.sin(niche_angle), 2.6)
        alcove.rotation_euler = (0.0, 0.0, niche_angle + math.pi / 2.0)
        for shelf in range(3):
            for row in range(6):
                volume = bpy.data.objects.new("Archive_Book_%02d_%02d_%02d" % (index,shelf,row), book_mesh)
                collection.objects.link(volume)
                local_x = (row - 2.5) * 0.28
                # 沿壁龛法线摆放，书本宽度走圆周切线方向。
                radial = Vector((math.cos(niche_angle), math.sin(niche_angle), 0.0))
                tangent_vec = Vector((-math.sin(niche_angle), math.cos(niche_angle), 0.0))
                position = radial * 14.3 + tangent_vec * local_x
                volume.location = (position.x, position.y, 1.35 + shelf * 0.78)
                volume.rotation_euler = (0.0, 0.0, niche_angle + math.pi / 2.0)

    # 高层弧形黑金檐线：将两层画廊与参考图中的波浪形边界连成一个整体。
    for level, z in enumerate((4.45, 7.35)):
        for side in (-1, 1):
            curve_data = bpy.data.curves.new("Archive_Wave_Eave_%d_%d" % (level, side), type="CURVE")
            curve_data.dimensions = "3D"
            curve_data.bevel_depth = 0.09
            curve_data.bevel_resolution = 2
            spline = curve_data.splines.new("BEZIER")
            spline.bezier_points.add(4)
            for point_index, point in enumerate(spline.bezier_points):
                x = side * (4.0 + point_index * 2.4)
                y = -5.8 + point_index * 3.0
                point.co = (x, y, z + 0.45 * math.sin(point_index * math.pi / 4.0))
                point.handle_left_type = "AUTO"
                point.handle_right_type = "AUTO"
            eave = bpy.data.objects.new("Archive_Black_Gold_Wave_Eave_%d_%d" % (level, side), curve_data)
            collection.objects.link(eave)
            curve_data.materials.append(wood)
    return 8


# -----------------------------------------------------------------------------
# 4. 几何苍穹穹顶
# -----------------------------------------------------------------------------


def create_geodesic_dome(collection):
    glass = make_pbr("Geodesic_Deep_Blue_Glass", (0.005,0.018,0.08), metallic=0.35, roughness=0.1,
                     emission=(0.0,0.045,0.25), emission_strength=1.5, alpha=0.34)
    metal = make_pbr("Geodesic_Dark_Metal_Frame", (0.018,0.024,0.035), metallic=0.95, roughness=0.2,
                     emission=(0.22,0.1,0.025), emission_strength=2.2)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=15.5, location=(0,0,15.0))
    dome = bpy.context.object
    dome.name = "Geodesic_Glass_Dome"
    move_to(dome, collection)
    # 删除下半球，只保留覆盖展馆的扁平顶部。
    mesh = dome.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.delete(bm, geom=[vertex for vertex in bm.verts if vertex.co.z < 0.0], context="VERTS")
    bm.to_mesh(mesh)
    bm.free()
    dome.scale.z = 0.42
    bpy.context.view_layer.objects.active = dome
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    dome.data.materials.append(glass)

    skeleton = dome.copy()
    skeleton.data = dome.data.copy()
    skeleton.name = "Geodesic_Metal_Wireframe_Applied"
    collection.objects.link(skeleton)
    skeleton.data.materials.clear()
    skeleton.data.materials.append(metal)
    modifier = skeleton.modifiers.new("Geodesic_Wireframe_Applied", "WIREFRAME")
    modifier.thickness = 0.055
    modifier.use_replace = True
    bpy.context.view_layer.objects.active = skeleton
    try:
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    except Exception:
        pass
    return dome, skeleton


def create_lighting_and_camera(scene, collections):
    """暖金主光和深蓝辅光，摄像机正对三封互动信件。"""
    lighting = bpy.data.collections.new("HISTORY_HALL_LIGHTING")
    scene.collection.children.link(lighting)
    for name, location, color, energy, size in (
        ("History_Warm_Key", (0,-4,10), (1.0,0.22,0.04), 1400.0, 7.0),
        ("History_Blue_Rim", (0,10,12), (0.0,0.2,1.0), 1100.0, 8.0),
        ("History_Canal_Uplight", (0,0,-1.4), (0.0,0.35,1.0), 900.0, 6.0),
    ):
        data = bpy.data.lights.new(name + "_Data", type="AREA")
        data.energy, data.color, data.shape, data.size = energy, color, "DISK", size
        light = bpy.data.objects.new(name, data)
        lighting.objects.link(light)
        light.location = location
        look_at(light, (0,0,2))
    camera_data = bpy.data.cameras.new("History_Hall_Camera_Data")
    camera = bpy.data.objects.new("History_Hall_Camera", camera_data)
    lighting.objects.link(camera)
    # 广角入口视角：水道、中央台阶、画卷墙与天幕同时成为可读的空间层次。
    camera.location = (0.0, -10.3, 4.25)
    camera.data.lens = 29
    look_at(camera, (0.0, 1.6, 3.8))
    scene.camera = camera
    return camera


def history_export_objects():
    root = bpy.data.collections.get(ROOT_COLLECTION)
    if not root:
        return []
    return [obj for obj in root.all_objects if obj.type in {"MESH", "EMPTY"}]


def export_history_hall_gltf(filepath):
    """导出本历史文化馆，不包含灯光/摄像机，保留全部关键帧对象。"""
    old_scene = bpy.context.window.scene
    scene = bpy.data.scenes.get(SCENE_NAME)
    bpy.context.window.scene = scene
    previous = list(bpy.context.selected_objects)
    try:
        bpy.ops.object.select_all(action="DESELECT")
        objects = history_export_objects()
        for obj in objects:
            obj.select_set(True)
        if objects:
            bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.export_scene.gltf(filepath=filepath, export_format="GLB", use_selection=True,
                                  export_animations=True, export_lights=False, export_cameras=False)
    finally:
        bpy.ops.object.select_all(action="DESELECT")
        for obj in previous:
            if obj and obj.name in bpy.data.objects:
                obj.select_set(True)
        bpy.context.window.scene = old_scene


def build_history_hall():
    scene, collections = prepare_scene()
    scroll, letters = create_scroll_and_letters(collections[SCROLL_COLLECTION])
    boat = create_canal_and_platform(collections[CANAL_COLLECTION])
    frame_count = create_archive_galleries(collections[ARCHIVE_COLLECTION])
    dome, skeleton = create_geodesic_dome(collections[DOME_COLLECTION])
    camera = create_lighting_and_camera(scene, collections)
    scene.frame_set(1)
    scene["project"] = "Wuzhen History Cultural Hall"
    scene["interactive_prefix"] = "Interactive_"
    scene["interactive_letters"] = [letter.name for letter in letters]
    scene["flying_page_count"] = 130
    scene["history_frame_count"] = frame_count
    scene["gltf_ready"] = True
    print("Wuzhen History Cultural Hall generated")
    print("Interactive letters:", scene["interactive_letters"])
    print("Export objects:", len(history_export_objects()))
    return scene


build_history_hall()
