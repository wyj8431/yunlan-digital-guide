"""Reference-image reconstruction for Wuzhen History Cultural Hall.

This is an architectural rebuild: a contained, cinematic archive hall rather
than a collection of isolated objects. It preserves three Interactive_ letters
for WebGL raycasting and uses only mesh objects plus keyframe animation.
"""

import math
import bmesh
import bpy
from mathutils import Vector

SCENE_NAME = "Wuzhen_History_Cultural_Hall"
ROOT = "HISTORY_HALL_REFERENCE_ROOT"
COLLECTIONS = ("HISTORY_ARCHITECTURE", "HISTORY_EXHIBITS", "HISTORY_INTERACTION", "HISTORY_LIGHTING")


def input_socket(node, names):
    return next((item for item in node.inputs if item.identifier in names or item.name in names), None)


def put(node, names, value):
    item = input_socket(node, names)
    if item:
        item.default_value = value


def material(name, base, metal=0.0, rough=0.4, emit=None, power=0.0, alpha=1.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    put(shader, {"Base Color", "base_color", "基础色"}, (*base, 1.0))
    put(shader, {"Metallic", "metallic", "金属度"}, metal)
    put(shader, {"Roughness", "roughness", "粗糙度"}, rough)
    put(shader, {"Alpha", "alpha", "透明度"}, alpha)
    if emit:
        put(shader, {"Emission", "Emission Color", "emission_color", "发光", "发光颜色"}, (*emit, 1.0))
        put(shader, {"Emission Strength", "emission_strength", "发光强度"}, power)
    links.new(shader.outputs[0], output.inputs["Surface"])
    if alpha < 1.0:
        try:
            mat.surface_render_method = "DITHERED"
        except Exception:
            pass
    return mat


def dome_glass_material():
    """Reference-style blue glass: transparent with a restrained glossy reflection."""
    name = "Ref_Dome_Transparent_Blue_Glass"
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    mix = nodes.new("ShaderNodeMixShader"); mix.inputs[0].default_value = 0.48
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    glossy = nodes.new("ShaderNodeBsdfGlossy")
    glossy.inputs[0].default_value = (0.456, 0.651, 0.896, 1.0)
    glossy.inputs[1].default_value = 0.08
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(glossy.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs["Surface"])
    try:
        mat.surface_render_method = "DITHERED"
    except Exception:
        pass
    return mat


def box_mesh(name, x, y, z):
    hx, hy, hz = x / 2, y / 2, z / 2
    vertices = [(-hx,-hy,-hz),(hx,-hy,-hz),(hx,hy,-hz),(-hx,hy,-hz),
                (-hx,-hy,hz),(hx,-hy,hz),(hx,hy,hz),(-hx,hy,hz)]
    faces = [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(4,0,3,7)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    return mesh


def add_box(name, collection, mesh, location, rotation=(0,0,0), scale=(1,1,1)):
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.location, obj.rotation_euler, obj.scale = location, rotation, scale
    return obj


def add_arc(name, collection, radius, z, start_angle, end_angle, thickness, material_ref):
    """创建有入口缺口的圆弧回廊边线，避免完整圆环遮挡中庭视线。"""
    data = bpy.data.curves.new(name + "_Curve", type="CURVE")
    data.dimensions = "3D"
    data.bevel_depth = thickness
    data.bevel_resolution = 2
    spline = data.splines.new("NURBS")
    points = 112
    spline.points.add(points - 1)
    for index, point in enumerate(spline.points):
        angle = start_angle + (end_angle - start_angle) * index / (points - 1)
        point.co = (radius * math.cos(angle), radius * math.sin(angle), z, 1.0)
    spline.order_u = 3
    spline.use_endpoint_u = True
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    data.materials.append(material_ref)
    return obj


def cycles(action):
    if not action:
        return
    if hasattr(action, "fcurves"):
        curves = list(action.fcurves)
    else:
        curves = []
        for layer in getattr(action, "layers", []):
            for strip in getattr(layer, "strips", []):
                for slot in getattr(action, "slots", []):
                    try:
                        curves.extend(list(strip.channelbag(slot).fcurves))
                    except Exception:
                        pass
    for curve in curves:
        for key in curve.keyframe_points:
            key.interpolation = "BEZIER"
        if not any(mod.type == "CYCLES" for mod in curve.modifiers):
            curve.modifiers.new(type="CYCLES")


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def reset_scene():
    scene = bpy.data.scenes.get(SCENE_NAME) or bpy.data.scenes.new(SCENE_NAME)
    bpy.context.window.scene = scene
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for child in list(scene.collection.children):
        scene.collection.children.unlink(child)
        if child.users == 0:
            bpy.data.collections.remove(child)
    root = bpy.data.collections.new(ROOT)
    scene.collection.children.link(root)
    collections = {}
    for name in COLLECTIONS:
        collection = bpy.data.collections.new(name)
        root.children.link(collection)
        collections[name] = collection
    engine_ids = {x.identifier for x in scene.render.bl_rna.properties["engine"].enum_items}
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engine_ids else "BLENDER_EEVEE"
    scene.render.resolution_x = 2560
    scene.render.resolution_y = 1440
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.frame_start, scene.frame_end = 1, 250
    world = bpy.data.worlds.get("History_Reference_World") or bpy.data.worlds.new("History_Reference_World")
    scene.world = world
    world.use_nodes = True
    bg = next(node for node in world.node_tree.nodes if node.type == "BACKGROUND")
    # Reference lighting starts from a restrained deep-blue night exterior.
    bg.inputs["Color"].default_value = (0.008, 0.013, 0.025, 1)  # #141c2b, linear approximation
    bg.inputs["Strength"].default_value = 0.12
    return scene, collections


def build_architecture(collection):
    dark = material("Ref_Black_Gold_Architectural_Metal", (0.014,0.009,0.01), 0.8, 0.26)
    wood = material("Ref_Dark_Walnut", (0.07,0.018,0.006), 0.22, 0.38)
    # Keep metal believable: the warm glow comes from separate thin light bands,
    # not every architectural edge becoming a neon outline.
    gold = material("Ref_Warm_Gold_Trim", (0.42,0.20,0.055), 0.72, 0.22, (1.0,0.34,0.07), 1.1)
    blue = material("Ref_Deep_Blue_Glass", (0.004,0.02,0.09), 0.25, 0.14, (0.0,0.04,0.35), 1.6, 0.4)
    water = material("Ref_Indoor_Canal_Water", (0.002,0.009,0.03), 0.95, 0.025, (0.0,0.03,0.14), 0.6)
    cream = material("Ref_Archive_Cream_Wall", (0.56,0.41,0.25), 0.0, 0.64)
    railing = material("Ref_Interior_Glass_Railing", (0.01,0.12,0.20), 0.15, 0.08, (0.0,0.12,0.32), 0.55, 0.25)
    architecture_mesh = box_mesh("Ref_Architecture_Block", 1,1,1)

    # Warm polished stone floor follows the reference image; the dark structural
    # metal remains on the architectural trim instead of swallowing the atrium.
    floor_mesh = box_mesh("Ref_Main_Floor", 34, 34, 0.25)
    floor_mesh.materials.append(material("Ref_Polished_Stone_Floor", (0.50,0.39,0.24), 0.0, 0.14))
    add_box("Museum_Main_Floor", collection, floor_mesh, (0, 0, -0.2))

    # Twin indoor canals sit below the main circulation path.
    # The water is only slightly below the circulation floor so it remains a
    # readable feature in the hero camera instead of disappearing into shadow.
    canal_mesh = box_mesh("Ref_Canal_Water", 4.4, 22.0, 0.08)
    canal_mesh.materials.append(water)
    edge_mesh = box_mesh("Ref_Canal_Bronze_Edge", 0.12, 22.2, 0.14)
    canal_edge = material("Ref_Canal_Bronze_Edge_Material", (0.11,0.035,0.008), 0.72, 0.30)
    edge_mesh.materials.append(canal_edge)
    for side in (-1, 1):
        x = side * 8.0
        add_box("Indoor_Canal_" + ("L" if side < 0 else "R"), collection, canal_mesh, (x, 0, -0.27))
        for offset in (-2.28, 2.28):
            add_box("Canal_Edge_%s_%s" % (side, offset), collection, edge_mesh, (x + offset, 0, -0.11))

    # Two deliberately simple, export-safe Wupeng boats give the canals a human
    # scale. Each is made from meshes and a small keyed float, not a simulation.
    hull = box_mesh("Ref_Wupeng_Boat_Hull", 1.15, 3.35, 0.34); hull.materials.append(wood)
    canopy = box_mesh("Ref_Wupeng_Boat_Canopy", 0.92, 1.36, 0.48); canopy.materials.append(dark)
    lantern = material("Ref_Wupeng_Lantern", (0.65,0.12,0.012), 0.15, 0.3, (1.0,0.19,0.018), 3.0)
    for boat_index, (x, y, phase) in enumerate(((-8.0, 3.5, 0.0), (8.0, -3.0, 2.1))):
        boat = add_box("Indoor_Canal_Wupeng_Boat_%d" % boat_index, collection, hull, (x,y,-0.04), (0.0,0.0,0.07*(-1 if boat_index else 1)))
        roof = add_box("Indoor_Canal_Wupeng_Canopy_%d" % boat_index, collection, canopy, (x,y+0.22,0.32), boat.rotation_euler)
        roof.parent=boat
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.16, location=(x,y-1.42,0.38))
        lamp=bpy.context.object; lamp.name="Indoor_Canal_Boat_Lantern_%d"%boat_index; collection.objects.link(lamp); lamp.data.materials.append(lantern); lamp.parent=boat
        base_z=-0.04
        for frame in (1, 125, 250):
            boat.location.z=base_z+0.055*math.sin(math.tau*(frame-1)/249+phase)
            boat.keyframe_insert(data_path="location", index=2, frame=frame)
        cycles(boat.animation_data.action)

    # The atrium stays open. A flush gold-stone approach replaces the old straight stair block.
    approach = box_mesh("Ref_Grand_Approach", 7.4, 11.0, 0.12)
    approach.materials.append(material("Ref_Polished_Gold_Stone", (0.24,0.12,0.045), 0.15, 0.14))
    add_box("Archive_Grand_Approach", collection, approach, (0, -6.5, -0.04))

    # Two-level circular balconies and a raised black-gold roofline.
    # Keep a 90-degree opening at the entry (front/-Y); the galleries wrap sides and rear only.
    arc_start, arc_end = -math.pi / 4.0, math.pi * 1.25
    for level, z in enumerate((2.9, 6.3)):
        # Slender gallery lips keep the atrium visually open, like the reference's
        # floating balconies rather than thick opaque rings.
        add_arc("Archive_Balcony_Trim_%d" % level, collection, 13.5, z, arc_start, arc_end, 0.045, dark)
        add_arc("Archive_Balcony_Glass_Rail_%d" % level, collection, 12.72, z + 0.82, arc_start, arc_end, 0.014, railing)
        add_arc("Archive_Balcony_Gold_Cap_%d" % level, collection, 12.72, z + 1.36, arc_start, arc_end, 0.008, gold)

    # Lower galleries use parchment-toned exhibition walls, while the upper
    # level recedes into deep-blue glass to echo the reference dome atmosphere.
    upper_wall = material("Ref_Upper_Blue_Archive_Wall", (0.006,0.035,0.10), 0.35, 0.22, (0.0,0.045,0.16), 0.55, 0.72)
    wall_mesh = box_mesh("Ref_Wall_Module", 4.8, 0.6, 4.8); wall_mesh.materials.append(cream)
    upper_wall_mesh = box_mesh("Ref_Upper_Wall_Module", 4.8, 0.6, 4.8); upper_wall_mesh.materials.append(upper_wall)
    frame_mesh = box_mesh("Ref_History_Frame", 4.15, 0.12, 2.65); frame_mesh.materials.append(gold)
    art_mesh = box_mesh("Ref_History_Art_Panel", 3.65, 0.05, 2.15)
    art_mesh.materials.append(material("Ref_Parchment_History_Screen", (0.58,0.33,0.10), 0.0, 0.58, (0.28,0.075,0.008), 0.12))
    ink_mesh = box_mesh("Ref_Archive_Ink_Block", 2.7, 0.035, 0.08)
    ink_mesh.materials.append(material("Ref_Archive_Ink", (0.006,0.002,0.001), 0.0, 0.82))
    shelf_mesh = box_mesh("Ref_Bookcase", 2.2, 0.28, 2.85); shelf_mesh.materials.append(wood)
    book_mesh = box_mesh("Ref_Book_Spine", 0.16,0.22,0.58); book_mesh.materials.append(gold)
    # No front-center wall modules: preserves the entrance frame and view of the central composition.
    for index in range(18):
        angle = math.tau * index / 18.0
        if abs(math.sin(angle) + 1.0) < 0.18:
            continue
        tangent = angle + math.pi / 2
        for level, z in enumerate((2.35, 6.0)):
            radius = 15.5
            add_box("Archive_Wall_%02d_%d" % (index, level), collection, upper_wall_mesh if level == 1 else wall_mesh,
                    (radius*math.cos(angle), radius*math.sin(angle), z), (0,0,tangent))
            # Gallery frames occur mostly on inner face.
            frame = add_box("History_Frame_%02d_%d" % (index,level), collection, frame_mesh,
                            (14.98*math.cos(angle),14.98*math.sin(angle), z+0.1), (0,0,tangent))
            panel = add_box("History_Panel_%02d_%d" % (index,level), collection, art_mesh,
                            (14.89*math.cos(angle),14.89*math.sin(angle), z+0.1), (0,0,tangent))
            frame["front_end_role"] = "historical_exhibit_frame"
            panel["front_end_role"] = "replaceable_history_art"
            # Parchment-map marks: these become clear, warm archival placeholders
            # in a render and are intentionally separate meshes for WebGL swaps.
            for map_row in range(4):
                mark_width = 1.45 + 0.34 * ((index + map_row) % 3)
                mark_mesh = box_mesh("Ref_Archive_Map_Mark", mark_width, 0.025, 0.035)
                mark_mesh.materials.append(gold if map_row == 0 else ink_mesh.materials[0])
                radial = Vector((math.cos(angle), math.sin(angle), 0))
                mark_pos = radial * 14.83 + Vector((0,0,z + 0.55 - map_row * 0.34))
                add_box("Archive_Map_Mark_%02d_%d_%d" % (index, level, map_row), collection, mark_mesh,
                        mark_pos, (0,0,tangent))
            # 文献块作为低成本的版式占位，前端可替换为真实历史图文纹理。
            for text_row in range(7):
                local_z = z - 0.7 + text_row * 0.22
                radial = Vector((math.cos(angle), math.sin(angle), 0))
                text = add_box("Archive_Text_%02d_%d_%02d" % (index,level,text_row), collection, ink_mesh,
                               (14.84*radial.x,14.84*radial.y,local_z), (0,0,tangent),
                               (0.55 + 0.06 * ((text_row+index)%3),1,1))
        # Dark bookcases fill alternating lower wall bays.
        if index % 2 == 0:
            shelf = add_box("Archive_Bookcase_%02d" % index, collection, shelf_mesh,
                            (14.88*math.cos(angle),14.88*math.sin(angle),1.9), (0,0,tangent))
            for row in range(3):
                for col in range(8):
                    local = (col-3.5)*0.23
                    pos = Vector((math.cos(angle),math.sin(angle),0))*14.68 + Vector((-math.sin(angle),math.cos(angle),0))*local
                    add_box("Archive_Book_%02d_%02d_%02d" % (index,row,col), collection, book_mesh,
                            (pos.x,pos.y,0.95+row*0.72), (0,0,tangent))

    # The modular wall fronts already provide the concave exhibition rhythm.
    # Avoid a full closed ring here: in Eevee it reads as a pair of horizontal
    # rails across the hero shot rather than as a wall contour.
    for level, z in []:
        data = bpy.data.curves.new("Archive_Soft_Wave_Band_%d" % level, type="CURVE")
        # Keep the wave contour as a thin architectural reveal. A large bevel on
        # a closed NURBS ring reads as an accidental black beam in Eevee.
        data.dimensions = "3D"; data.bevel_depth = 0.025; data.bevel_resolution = 3
        spline = data.splines.new("NURBS"); spline.points.add(95)
        for i, point in enumerate(spline.points):
            angle = math.tau * i / 95.0
            radius = 12.95 + 0.38 * math.sin(angle * 6.0)
            point.co = (radius * math.cos(angle), radius * math.sin(angle), z, 1.0)
        spline.use_cyclic_u = True
        band = bpy.data.objects.new("Archive_Soft_Wave_Band_%d" % level, data)
        collection.objects.link(band); data.materials.append(gold)
    return dark, gold, blue, water


def build_central_exhibits(collection, dark, gold):
    blue = material("Ref_Temporal_Blue", (0.0,0.08,0.18), 0.15, 0.2, (0.0,0.55,1.0), 15.0)
    # #e8ddc2 parchment with restrained warm #ffddaa emission.
    parchment = material("Ref_Golden_History_Scroll", (0.806,0.723,0.539), 0.0, 0.72, (1.0,0.723,0.402), 0.35)
    paper = material("Ref_Warm_Flying_Paper", (0.71,0.58,0.38), 0.0, 0.72, None, 0.0, 0.94)
    interaction_paper = material("Ref_Interactive_Letter_Parchment", (0.62,0.33,0.10), 0.0, 0.55, (0.18,0.018,0.001), 0.22)
    interaction_gold = material("Ref_Interactive_Letter_Gold", (0.24,0.065,0.008), 0.55, 0.2, (0.75,0.10,0.004), 2.2)

    # Multi-level temporal origin platform with concentric warm light bands.
    for index, (radius,z) in enumerate(((3.5,0.18),(2.8,0.4),(2.15,0.62))):
        bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=radius, depth=0.22, location=(0,0,z))
        platform = bpy.context.object; platform.name = "Temporal_Archive_Podium_%d" % index
        collection.objects.link(platform); platform.data.materials.append(dark)
    ring_light = material("Ref_Ground_Gold_Lightband", (1.0,0.723,0.402), 0.0, 0.3, (1.0,0.723,0.402), 1.8)
    for radius in (1.1,1.6,2.15,2.75):
        bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=0.032, major_segments=128, minor_segments=10, location=(0,0,0.79))
        obj = bpy.context.object; obj.name = "Temporal_Cyan_Ring_%.1f" % radius
        collection.objects.link(obj); obj.data.materials.append(ring_light)

    # The requested centrepiece: 6 m radius, 2.7 turns, 14 m rise and
    # 32 samples per revolution. It deliberately varies radius from bottom to
    # top: lower expansion, stable middle, and a narrowed lifted tip.
    vertices, faces, uv = [], [], []
    segments, width = 86, 1.55
    for i in range(segments+1):
        t = i/segments; angle = math.tau*(-0.25+2.7*t)
        radius = 6.0 * (0.38 + 0.62*t)
        # The top folds inward, creating a lifted paper tip rather than a spring end.
        taper = 1.0 - 0.34 * max(0.0, (t-0.84)/0.16)
        center = Vector((radius*taper*math.cos(angle), radius*taper*math.sin(angle), 1.05+14.0*t))
        normal = Vector((math.cos(angle),math.sin(angle),0))
        for sign in (-1,1):
            vertices.append(tuple(center + normal*sign*width/2)); uv.append((t,0 if sign<0 else 1))
    for i in range(segments):
        a=i*2; faces.append((a,a+1,a+3,a+2))
    mesh = bpy.data.meshes.new("Grand_Historical_Scroll_UV_Mesh")
    mesh.from_pydata(vertices, [], faces); mesh.update(); mesh.materials.append(parchment)
    layer=mesh.uv_layers.new(name="HistoricalArchiveUV")
    for poly in mesh.polygons:
        for loop in poly.loop_indices: layer.data[loop].uv=uv[mesh.loops[loop].vertex_index]
    scroll=bpy.data.objects.new("Grand_Spiral_Historical_Scroll",mesh); collection.objects.link(scroll)
    scroll["front_end_uv_slot"]="HistoricalArchiveUV"

    # A separate narrow edge strip carries the requested D6A75A warm highlight
    # without turning the entire historical paper into a metal sculpture.
    edge_mat = material("Ref_Scroll_Gold_Edge", (0.67,0.39,0.12), 0.2, 0.3, (0.85,0.30,0.04), 0.75)
    edge_vertices, edge_faces = [], []
    inset = 0.055
    for i in range(segments+1):
        t=i/segments; angle=math.tau*(-0.25+2.7*t); radius=6.0*(0.38+0.62*t)
        taper=1.0-0.34*max(0.0,(t-0.84)/0.16)
        center=Vector((radius*taper*math.cos(angle),radius*taper*math.sin(angle),1.05+14.0*t))
        normal=Vector((math.cos(angle),math.sin(angle),0))
        for sign in (-1,1):
            edge_vertices.append(tuple(center + normal*sign*(width/2-inset)))
            edge_vertices.append(tuple(center + normal*sign*(width/2-inset-0.065)))
    for i in range(segments):
        a=i*4; n=(i+1)*4
        edge_faces.extend(((a,n,n+1,a+1),(a+2,a+3,n+3,n+2)))
    edge_mesh=bpy.data.meshes.new("Grand_Scroll_Gold_Edge_Mesh"); edge_mesh.from_pydata(edge_vertices,[],edge_faces); edge_mesh.update(); edge_mesh.materials.append(edge_mat)
    edge_obj=bpy.data.objects.new("Grand_Scroll_Warm_Gold_Edge",edge_mesh); collection.objects.link(edge_obj)

    # A separate hanging roll gives the lower endpoint its downturned paper-tube form.
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.45, depth=2.1, location=(0.0, -2.45, 1.62), rotation=(0.42,0.18,0.55))
    tail = bpy.context.object; tail.name = "Grand_Scroll_Draped_Paper_Roll"; collection.objects.link(tail)
    tail.data.materials.append(parchment)

    # Fewer pages, distributed at the scroll perimeter as atmosphere instead of visual noise.
    page_mesh=box_mesh("Reference_Flying_Page_Shared",0.58,0.04,0.82); page_mesh.materials.append(paper)
    # Six pages stay off the central camera axis so they frame rather than obscure
    # the scroll.  They remain individual keyframed meshes for WebGL export.
    for i in range(6):
        angle=(-2.55 + i*1.02); radius=5.2+(i%2)*0.75; base=(radius*math.cos(angle),radius*math.sin(angle),3.0+(i%3)*1.55)
        page=add_box("Reference_Flying_Page_%02d"%i,collection,page_mesh,base,(0.2,0.35,angle))
        phase=angle
        for frame in (1,63,125,188,250):
            t=(frame-1)/249; wave=math.tau*t+phase
            page.location=(base[0]+0.18*math.sin(wave),base[1]+0.18*math.cos(wave),base[2]+0.22*math.sin(wave*1.2))
            page.rotation_euler=(0.2+0.25*math.sin(wave),0.35,angle+0.3*math.cos(wave))
            page.keyframe_insert(data_path="location",frame=frame); page.keyframe_insert(data_path="rotation_euler",frame=frame)
        cycles(page.animation_data.action)

    # Three fixed, front-facing interaction letters at the edge of the central podium.
    letter_mesh=box_mesh("Reference_Interactive_Letter_Mesh",0.78,0.045,1.05); letter_mesh.materials.append(interaction_paper)
    border_h=box_mesh("Reference_Interactive_Letter_Border_H",0.86,0.06,0.055); border_h.materials.append(interaction_gold)
    border_v=box_mesh("Reference_Interactive_Letter_Border_V",0.055,0.06,1.13); border_v.materials.append(interaction_gold)
    for name,loc,phase in (("Interactive_Letter_MaoDun",(-2.35,-3.5,1.65),0),
                           ("Interactive_Letter_History",(0,-3.9,1.95),2.1),
                           ("Interactive_Letter_WuzhenArchive",(2.35,-3.5,1.65),4.2)):
        letter=add_box(name,collection,letter_mesh,loc,(0.0,0.0,0.0))
        letter["interactive"] = True; letter["raycast_target"] = name; letter["interaction_type"]="historical_archive"
        for border, offset in ((border_h,(0,0.02,0.555)),(border_h,(0,0.02,-0.555)),
                               (border_v,(0.415,0.02,0)),(border_v,(-0.415,0.02,0))):
            edge=add_box(name+"_Gold_Edge",collection,border,offset)
            edge.parent=letter
        for frame in (1,125,250):
            letter.location.z=loc[2]+0.14*math.sin(math.tau*(frame-1)/249+phase)
            letter.keyframe_insert(data_path="location",index=2,frame=frame)
        cycles(letter.animation_data.action)


def build_dome(collection, blue, gold):
    steel = material("Ref_Dome_Steel_Structure", (0.12,0.15,0.19), 0.85, 0.22)
    glass = dome_glass_material()
    # Exterior glass shell: a complete upper hemisphere, slightly larger than the steel cage.
    # Raise the equator above the second gallery.  At the previous 7.1 m
    # centre, the cut edge of the upper hemisphere sat directly in the camera
    # line and rendered as an opaque black horizontal band.
    dome_center_z = 8.8
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=17.72, location=(0,0,dome_center_z))
    glass_shell=bpy.context.object; glass_shell.name="Reference_Transparent_Glass_Dome"; collection.objects.link(glass_shell)
    bm=bmesh.new(); bm.from_mesh(glass_shell.data)
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z<0],context="VERTS"); bm.to_mesh(glass_shell.data); bm.free()
    glass_shell.scale.z=0.50; bpy.context.view_layer.objects.active=glass_shell; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    glass_shell.data.materials.append(glass)
    # Independent, slightly smaller steel wireframe cage. Geometry is applied for stable glTF export.
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=17.48, location=(0,0,dome_center_z))
    frame=bpy.context.object; frame.name="Reference_Steel_Geodesic_Dome_Frame"; collection.objects.link(frame)
    bm=bmesh.new(); bm.from_mesh(frame.data)
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z<0],context="VERTS"); bm.to_mesh(frame.data); bm.free()
    frame.scale.z=0.495; bpy.context.view_layer.objects.active=frame; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    frame.data.materials.append(steel)
    # Applied wireframe gives a stable, glTF-exportable structural roof cage.
    # This dome spans 35 m, so 0.035 m preserves the 0.22-style perceived member
    # weight without camera-side intersections overwhelming the atrium.
    modifier=frame.modifiers.new("Applied_Steel_Wireframe","WIREFRAME"); modifier.thickness=0.009; modifier.use_replace=True
    modifier.use_even_offset = True
    modifier.use_boundary = True
    bpy.context.view_layer.objects.active=frame
    try: bpy.ops.object.modifier_apply(modifier=modifier.name)
    except Exception: pass
    frame["nominal_architectural_thickness_m"] = 0.22
    frame["render_scale_adjusted"] = True
    # No decorative oculus rings: the continuous triangular grid remains legible
    # as a complete glass-and-steel hemisphere in the reference composition.


def lighting_camera(scene, collection):
    for name,loc,color,energy,size,target in (
        ("History_Warm_Key",(0,-1,12),(1.0,0.42,0.14),1200,8,(0,0,5)),
        ("History_Warm_Side_L",(-12,-3,7),(1.0,0.12,0.018),750,5,(0,2,3)),
        ("History_Warm_Side_R",(12,-3,7),(1.0,0.12,0.018),750,5,(0,2,3)),
        ("History_Blue_Canal",(0,8,7),(0.03,0.18,1.0),600,7,(0,0,3)),
        ("History_Dome_Cold_Soft",(0,0,14.5),(0.223,0.456,1.0),720,14,(0,0,4)),
    ):
        data=bpy.data.lights.new(name+"_Data",type="AREA"); data.energy=energy; data.color=color; data.shape="DISK"; data.size=size
        obj=bpy.data.objects.new(name,data); collection.objects.link(obj); obj.location=loc; look_at(obj,target)
    # Recessed warm washers expose the cream archive walls and exhibition panels.
    for level, z in enumerate((4.35, 7.75)):
        for index in range(12):
            angle = math.tau * index / 12.0
            if math.sin(angle) < -0.72:
                continue
            data=bpy.data.lights.new("Archive_Wall_Wash_%d_%d_Data" % (level,index), type="AREA")
            data.energy=280; data.color=(1.0,0.40,0.12); data.shape="RECTANGLE"; data.shape="RECTANGLE"; data.size=2.8; data.size_y=0.45
            obj=bpy.data.objects.new("Archive_Wall_Wash_%d_%d" % (level,index),data); collection.objects.link(obj)
            obj.location=(14.15*math.cos(angle),14.15*math.sin(angle),z)
            look_at(obj,(9.0*math.cos(angle),9.0*math.sin(angle),z-1.1))
    data=bpy.data.cameras.new("History_Reference_Camera_Data")
    camera=bpy.data.objects.new("History_Hall_Camera",data); collection.objects.link(camera)
    # The reference image uses a slightly elevated diagonal view across the atrium.
    # A raised diagonal interior view with an unobstructed centreline to the scroll.
    camera.location=(10.5,-21.5,10.8); data.lens=38
    data.dof.use_dof = True
    data.dof.focus_object = bpy.data.objects.get("Grand_Spiral_Historical_Scroll")
    data.dof.aperture_fstop = 11.0
    look_at(camera,(0,0.45,7.4)); scene.camera=camera
    return camera


def export_reference_glb(filepath):
    scene=bpy.data.scenes[SCENE_NAME]; bpy.context.window.scene=scene
    objects=[obj for obj in bpy.data.collections[ROOT].all_objects if obj.type in {"MESH","EMPTY"}]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects: obj.select_set(True)
    if objects: bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.export_scene.gltf(filepath=filepath,export_format="GLB",use_selection=True,export_animations=True,export_lights=False,export_cameras=False)


def build_reference_hall():
    scene, cols=reset_scene()
    dark,gold,blue,water=build_architecture(cols["HISTORY_ARCHITECTURE"])
    build_central_exhibits(cols["HISTORY_EXHIBITS"],dark,gold)
    build_dome(cols["HISTORY_ARCHITECTURE"],blue,gold)
    lighting_camera(scene,cols["HISTORY_LIGHTING"])
    # The requested fast preview configuration. All materials remain standard
    # Principled shaders so they also export predictably to glTF/WebGL.
    available = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in available else "BLENDER_EEVEE"
    try:
        scene.render.resolution_x, scene.render.resolution_y = 2560, 1440
        scene.render.image_settings.file_format = "PNG"
    except Exception:
        pass
    scene.frame_set(1)
    scene["project"]="Wuzhen History Cultural Hall / Reference Reconstruction"
    scene["interactive_prefix"]="Interactive_"
    scene["interactive_letters"]=["Interactive_Letter_MaoDun","Interactive_Letter_History","Interactive_Letter_WuzhenArchive"]
    print("Reference-style Wuzhen History Cultural Hall generated", len(scene.objects))


build_reference_hall()
