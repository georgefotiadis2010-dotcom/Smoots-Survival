"""
EXOTIC-016: Blender Python script to build, rig, animate, and export
FBI Director Vance in a stylized mid-poly Black & Gold Armored FBI Exo-Mech Suit
-> public/models/director_vance.glb (~5,500-7,500 tris, 2.3m tall, 6 animations).

Run headless:
    blender --background --python blender_scripts/build_boss_vance.py
"""

import os
import math
import json
import struct
import bpy
import bmesh
from mathutils import Vector, Matrix, Euler


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
MODELS_DIR = os.path.join(PROJECT_ROOT, "public", "models")
VANCE_GLB = os.path.join(MODELS_DIR, "director_vance.glb")


# ---------------------------------------------------------------------------
# Shared Helpers (Blender 5.2.3 LTS compatible, matching build_npcs.py)
# ---------------------------------------------------------------------------
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 30
    scene.frame_start = 1
    scene.frame_end = 60


def srgb_to_linear(c):
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def hex_to_rgba(hex_str, alpha=1.0):
    h = hex_str.lstrip("#")
    r = int(h[0:2], 16) / 255.0
    g = int(h[2:4], 16) / 255.0
    b = int(h[4:6], 16) / 255.0
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), alpha)


def make_toon_mat(
    name,
    hex_color,
    roughness=0.78,
    metallic=0.0,
    specular=0.25,
    emission_hex=None,
    emission_strength=0.0,
    backface_culling=False,
):
    mat = bpy.data.materials.new(name=name)
    if mat.node_tree is None:
        mat.use_nodes = True
    mat.use_backface_culling = backface_culling
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    if bsdf is None:
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = hex_to_rgba(hex_color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = specular
    if emission_hex and emission_strength > 0.0:
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = hex_to_rgba(emission_hex)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def make_outline_mat():
    return make_toon_mat(
        "Outline_Black",
        "#0B0C10",
        roughness=1.0,
        metallic=0.0,
        specular=0.0,
        backface_culling=True,
    )


def finish_bmesh_obj(name, bm, mat, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()

    # Clean box-projected UVs so every vertex has valid texcoords for glTF
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        n = poly.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for loop_idx in poly.loop_indices:
            v = mesh.vertices[mesh.loops[loop_idx].vertex_index].co
            if az >= ax and az >= ay:
                uv_layer.data[loop_idx].uv = (v.x * 0.5 + 0.5, v.y * 0.5 + 0.5)
            elif ax >= ay and ax >= az:
                uv_layer.data[loop_idx].uv = (v.y * 0.5 + 0.5, v.z * 0.5 + 0.5)
            else:
                uv_layer.data[loop_idx].uv = (v.x * 0.5 + 0.5, v.z * 0.5 + 0.5)

    mesh.polygons.foreach_set("use_smooth", [bool(smooth)] * len(mesh.polygons))

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def create_uv_sphere(
    name,
    location=(0, 0, 0),
    scale=(1, 1, 1),
    rot=(0, 0, 0),
    segs=12,
    rings=8,
    mat=None,
    smooth=True,
):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    rot_m = Euler(rot, "XYZ").to_matrix().to_4x4()
    scl_m = Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0))
    trn_m = Matrix.Translation(Vector(location))
    bmesh.ops.transform(bm, matrix=trn_m @ rot_m @ scl_m, verts=bm.verts)
    return finish_bmesh_obj(name, bm, mat, smooth=smooth)


def create_box(
    name,
    location=(0, 0, 0),
    size=(0.1, 0.1, 0.1),
    rot=(0, 0, 0),
    bevel=0.0,
    bevel_segs=1,
    mat=None,
    smooth=False,
):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    scl_m = Matrix.Diagonal((size[0], size[1], size[2], 1.0))
    bmesh.ops.transform(bm, matrix=scl_m, verts=bm.verts)
    if bevel > 0.0:
        bmesh.ops.bevel(
            bm,
            geom=list(bm.edges),
            offset=bevel,
            segments=bevel_segs,
            affect="EDGES",
            clamp_overlap=True,
        )
    rot_m = Euler(rot, "XYZ").to_matrix().to_4x4()
    trn_m = Matrix.Translation(Vector(location))
    bmesh.ops.transform(bm, matrix=trn_m @ rot_m, verts=bm.verts)
    return finish_bmesh_obj(name, bm, mat, smooth=smooth)


def create_cylinder(
    name,
    p0,
    p1,
    r0,
    r1=None,
    segs=10,
    mat=None,
    cap_ends=True,
    smooth=True,
):
    if r1 is None:
        r1 = r0
    v0 = Vector(p0)
    v1 = Vector(p1)
    axis = v1 - v0
    length = axis.length
    if length < 1e-6:
        length = 1e-4
        axis = Vector((0, 0, 1))
    mid = (v0 + v1) * 0.5
    quat = Vector((0, 0, 1)).rotation_difference(axis.normalized())

    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=cap_ends,
        cap_tris=False,
        segments=segs,
        radius1=r0,
        radius2=r1,
        depth=length,
    )
    mat4 = Matrix.Translation(mid) @ quat.to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=mat4, verts=bm.verts)
    return finish_bmesh_obj(name, bm, mat, smooth=smooth)


def create_torus_ring(
    name,
    center=(0, 0, 0),
    major_r=0.14,
    minor_r=0.02,
    major_segs=12,
    minor_segs=6,
    rot=(0, 0, 0),
    mat=None,
    smooth=True,
):
    """Low-poly torus ring for energy coils / chest reactor bezel."""
    bm = bmesh.new()
    rings = []
    for i in range(major_segs):
        theta = 2.0 * math.pi * i / major_segs
        ct, st = math.cos(theta), math.sin(theta)
        rv = []
        for j in range(minor_segs):
            phi = 2.0 * math.pi * j / minor_segs
            r = major_r + math.cos(phi) * minor_r
            x = ct * r
            y = st * r
            z = math.sin(phi) * minor_r
            rv.append(bm.verts.new((x, y, z)))
        rings.append(rv)

    for i in range(major_segs):
        i_next = (i + 1) % major_segs
        for j in range(minor_segs):
            j_next = (j + 1) % minor_segs
            bm.faces.new(
                (rings[i][j], rings[i_next][j], rings[i_next][j_next], rings[i][j_next])
            )

    rot_m = Euler(rot, "XYZ").to_matrix().to_4x4()
    trn_m = Matrix.Translation(Vector(center))
    bmesh.ops.transform(bm, matrix=trn_m @ rot_m, verts=bm.verts)
    return finish_bmesh_obj(name, bm, mat, smooth=smooth)


def create_lofted_tube(
    name,
    ring_specs,
    segs=12,
    mat=None,
    cap_start=True,
    cap_end=True,
    smooth=True,
):
    bm = bmesh.new()
    ring_verts = []
    for spec in ring_specs:
        pos = Vector(spec["pos"])
        rx = spec["rx"]
        ry = spec.get("ry", rx)
        rot = spec.get("rot", (0.0, 0.0, 0.0))
        rot_m = Euler(rot, "XYZ").to_matrix()
        rv = []
        for s in range(segs):
            a = 2.0 * math.pi * s / segs
            local = Vector((math.cos(a) * rx, math.sin(a) * ry, 0.0))
            world = pos + (rot_m @ local)
            rv.append(bm.verts.new(world))
        ring_verts.append(rv)

    for ri in range(len(ring_verts) - 1):
        r_a = ring_verts[ri]
        r_b = ring_verts[ri + 1]
        for s in range(segs):
            s_next = (s + 1) % segs
            bm.faces.new((r_a[s], r_a[s_next], r_b[s_next], r_b[s]))

    if cap_start:
        c0 = Vector(ring_specs[0]["pos"])
        v_start = bm.verts.new(c0)
        first = ring_verts[0]
        for s in range(segs):
            s_next = (s + 1) % segs
            bm.faces.new((v_start, first[s_next], first[s]))

    if cap_end:
        c1 = Vector(ring_specs[-1]["pos"])
        v_end = bm.verts.new(c1)
        last = ring_verts[-1]
        for s in range(segs):
            s_next = (s + 1) % segs
            bm.faces.new((v_end, last[s], last[s_next]))

    return finish_bmesh_obj(name, bm, mat, smooth=smooth)


def assign_rigid_weight(obj, bone_name):
    vg = obj.vertex_groups.get(bone_name) or obj.vertex_groups.new(name=bone_name)
    all_idx = [v.index for v in obj.data.vertices]
    vg.add(all_idx, 1.0, "REPLACE")


def assign_gradient_weight(obj, bone_a, bone_b, p_a, p_b, blend_power=1.0):
    va = Vector(p_a)
    vb = Vector(p_b)
    ab = vb - va
    ab_len_sq = max(ab.length_squared, 1e-8)

    vg_a = obj.vertex_groups.get(bone_a) or obj.vertex_groups.new(name=bone_a)
    vg_b = obj.vertex_groups.get(bone_b) or obj.vertex_groups.new(name=bone_b)

    for v in obj.data.vertices:
        t = (v.co - va).dot(ab) / ab_len_sq
        t = max(0.0, min(1.0, t))
        if blend_power != 1.0:
            t = t * t * (3.0 - 2.0 * t)
        w_b = t
        w_a = 1.0 - t
        if w_a > 1e-4:
            vg_a.add([v.index], w_a, "REPLACE")
        if w_b > 1e-4:
            vg_b.add([v.index], w_b, "REPLACE")


def add_fbi_letters(parts, center, scale_xyz, rot_xyz, mat_gold, bone_name, prefix="FBI"):
    """Build crisp 3D embossed 'FBI' lettering facing -Y (or rotated via rot_xyz)."""
    cx, cy, cz = center
    sx, sy, sz = scale_xyz
    rot_m = Euler(rot_xyz, "XYZ").to_matrix()

    # Local stroke segments (x, z, w, h) for F, B, I reading left-to-right from viewer (-X -> +X)
    strokes = [
        # 'F'
        (-0.85, 0.0, 0.17, 1.0),
        (-0.62, 0.42, 0.46, 0.17),
        (-0.66, 0.04, 0.38, 0.16),
        # 'B'
        (-0.22, 0.0, 0.17, 1.0),
        (0.02, 0.42, 0.42, 0.16),
        (0.02, 0.02, 0.42, 0.16),
        (0.02, -0.42, 0.42, 0.16),
        (0.20, 0.22, 0.16, 0.36),
        (0.22, -0.20, 0.16, 0.38),
        # 'I'
        (0.66, 0.0, 0.17, 1.0),
        (0.66, 0.42, 0.44, 0.16),
        (0.66, -0.42, 0.44, 0.16),
    ]
    for idx, (lx, lz, lw, lh) in enumerate(strokes):
        local_pos = Vector((lx * sx, 0.0, lz * sz))
        world_pos = Vector((cx, cy, cz)) + (rot_m @ local_pos)
        bar = create_box(
            f"{prefix}_Letter_{idx}",
            location=world_pos,
            size=(lw * sx, sy, lh * sz),
            rot=rot_xyz,
            bevel=0.0,
            mat=mat_gold,
            smooth=False,
        )
        assign_rigid_weight(bar, bone_name)
        parts.append((bar, 0.0))


def apply_outlines_and_join(parts_with_outline, outline_mat, final_name, armature_obj):
    """
    Applies Solidify inverted-hull outline BEFORE joining so each part can have
    tailored outline thickness (or 0.0 for small trim/glow details) and outline
    vertices inherit exact bone weights.
    """
    bpy.ops.object.select_all(action="DESELECT")
    objs = []
    for obj, thickness in parts_with_outline:
        if thickness and thickness > 0.0:
            obj.data.materials.append(outline_mat)
            outline_idx = len(obj.data.materials) - 1
            mod = obj.modifiers.new(name="Outline", type="SOLIDIFY")
            mod.thickness = thickness
            mod.offset = 1.0
            mod.use_flip_normals = True
            mod.use_rim = False
            mod.material_offset = outline_idx

            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.modifier_apply(modifier=mod.name)
            obj.select_set(False)
        objs.append(obj)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objs:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()

    merged = bpy.context.active_object
    merged.name = final_name
    merged.data.name = f"{final_name}_Data"

    # Clamp bottom cleanly onto Z = 0.0 so boots rest flush with zero float/clip
    min_z = min(v.co.z for v in merged.data.vertices)
    if abs(min_z) > 1e-6:
        for v in merged.data.vertices:
            v.co.z -= min_z
        merged.data.update()

    # Parent to armature and add Armature modifier
    merged.parent = armature_obj
    arm_mod = merged.modifiers.new(name="Armature", type="ARMATURE")
    arm_mod.object = armature_obj
    arm_mod.use_vertex_groups = True

    return merged


def create_armature(name, bone_defs):
    arm_data = bpy.data.armatures.new(f"{name}_Data")
    arm_obj = bpy.data.objects.new(name, arm_data)
    bpy.context.scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    arm_obj.select_set(True)

    bpy.ops.object.mode_set(mode="EDIT")
    created = {}
    for b_name, head, tail, parent_name, use_connect in bone_defs:
        eb = arm_data.edit_bones.new(b_name)
        eb.head = Vector(head)
        eb.tail = Vector(tail)
        if parent_name:
            eb.parent = created[parent_name]
            eb.use_connect = use_connect
        created[b_name] = eb

    bpy.ops.object.mode_set(mode="POSE")
    for pb in arm_obj.pose.bones:
        pb.rotation_mode = "XYZ"
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj


def reset_pose(arm_obj):
    for pb in arm_obj.pose.bones:
        pb.location = (0.0, 0.0, 0.0)
        pb.rotation_euler = (0.0, 0.0, 0.0)
        pb.scale = (1.0, 1.0, 1.0)


def kf_bone(arm_obj, bone_name, frame, rot_deg=None, loc=None):
    pb = arm_obj.pose.bones[bone_name]
    if rot_deg is not None:
        pb.rotation_euler = tuple(math.radians(a) for a in rot_deg)
        pb.keyframe_insert(data_path="rotation_euler", frame=frame)
    if loc is not None:
        pb.location = loc
        pb.keyframe_insert(data_path="location", frame=frame)


def push_action_to_nla(arm_obj, action_name, build_fn, frame_start, frame_end):
    if arm_obj.animation_data is None:
        arm_obj.animation_data_create()

    action = bpy.data.actions.new(name=action_name)
    arm_obj.animation_data.action = action

    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="POSE")
    reset_pose(arm_obj)

    build_fn(arm_obj)

    bpy.ops.object.mode_set(mode="OBJECT")

    track = arm_obj.animation_data.nla_tracks.new()
    track.name = action_name
    strip = track.strips.new(name=action_name, start=frame_start, action=action)
    strip.action_frame_start = frame_start
    strip.action_frame_end = frame_end
    strip.frame_end = frame_end
    arm_obj.animation_data.action = None
    reset_pose(arm_obj)


def export_glb(filepath, objects):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]

    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_skins=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_nla_strips=True,
        export_optimize_animation_size=False,
    )


def inspect_glb(filepath):
    """Parse GLB JSON chunk to verify triangle count, bounds, materials, and animations."""
    with open(filepath, "rb") as f:
        magic, version, length = struct.unpack("<4sII", f.read(12))
        chunk_len, chunk_type = struct.unpack("<II", f.read(8))
        gltf = json.loads(f.read(chunk_len).decode("utf-8"))

    accessors = gltf.get("accessors", [])
    total_tris = 0
    min_y = float("inf")
    max_y = float("-inf")
    for mesh in gltf.get("meshes", []):
        for prim in mesh.get("primitives", []):
            if "indices" in prim:
                total_tris += accessors[prim["indices"]]["count"] // 3
            else:
                pos_acc = prim["attributes"]["POSITION"]
                total_tris += accessors[pos_acc]["count"] // 3
            pos_idx = prim["attributes"].get("POSITION")
            if pos_idx is not None:
                acc = accessors[pos_idx]
                if "min" in acc and len(acc["min"]) >= 2:
                    min_y = min(min_y, acc["min"][1])
                if "max" in acc and len(acc["max"]) >= 2:
                    max_y = max(max_y, acc["max"][1])

    anims = [a.get("name", "<unnamed>") for a in gltf.get("animations", [])]
    mats = [
        (m.get("name", "<unnamed>"), m.get("doubleSided", False))
        for m in gltf.get("materials", [])
    ]
    size_kb = os.path.getsize(filepath) / 1024.0
    print(f"[VERIFY] {os.path.basename(filepath)} ({size_kb:.1f} KB)")
    print(f"  Triangles : {total_tris}")
    print(f"  Y Bounds  : min_y={min_y:.4f}, max_y={max_y:.4f} (height={max_y - min_y:.3f}m)")
    print(f"  Materials : {mats}")
    print(f"  Animations: {anims}")
    return total_tris, anims, mats, min_y, max_y


# ===========================================================================
# FBI DIRECTOR VANCE — BLACK & GOLD ARMORED EXO-MECH SUIT (~2.32m tall)
# ===========================================================================
def build_director_vance():
    reset_scene()

    # 2-Step Cel/Toon-ready glTF Materials
    mat_black = make_toon_mat("Vance_Armor_Black", "#151820", roughness=0.62, metallic=0.35, specular=0.38)
    mat_charcoal = make_toon_mat("Vance_Armor_Charcoal", "#2A3140", roughness=0.72, metallic=0.28, specular=0.30)
    mat_steel = make_toon_mat("Vance_Joint_Steel", "#4A5468", roughness=0.42, metallic=0.65, specular=0.55)
    mat_gold = make_toon_mat("Vance_Gold_Trim", "#F5C536", roughness=0.24, metallic=0.86, specular=0.72)
    mat_core_glow = make_toon_mat(
        "Vance_Core_GoldGlow",
        "#FFE066",
        roughness=0.16,
        metallic=0.20,
        emission_hex="#FFBC24",
        emission_strength=2.6,
    )
    mat_red_glow = make_toon_mat(
        "Vance_Visor_RedGlow",
        "#FF2030",
        roughness=0.12,
        metallic=0.15,
        emission_hex="#FF1E2D",
        emission_strength=3.2,
    )
    mat_net_glow = make_toon_mat(
        "Vance_Net_Energy",
        "#FFA928",
        roughness=0.18,
        metallic=0.15,
        emission_hex="#FF9D1A",
        emission_strength=2.6,
    )
    mat_skin = make_toon_mat("Vance_Skin_Jaw", "#DCA480", roughness=0.76, specular=0.18)
    mat_outline = make_outline_mat()

    # Armature (~2.32m imposing exo-mech boss, faces -Y -> +Z in Three.js, feet at Z=0)
    bone_defs = [
        ("Root", (0, 0, 0.0), (0, 0, 1.00), None, False),
        ("Hips", (0, 0, 1.00), (0, 0, 1.22), "Root", False),
        ("Spine", (0, 0, 1.22), (0, 0, 1.78), "Hips", True),
        ("Head", (0, 0, 1.78), (0, 0, 2.28), "Spine", True),
        ("Pauldron_L", (0.46, 0.0, 1.70), (0.64, 0.0, 1.84), "Spine", False),
        ("Pauldron_R", (-0.46, 0.0, 1.70), (-0.64, 0.0, 1.84), "Spine", False),
        # Left Arm (+X): Net Launcher Gauntlet
        ("Arm_L", (0.47, 0.0, 1.64), (0.55, -0.05, 1.32), "Spine", False),
        ("Forearm_L", (0.55, -0.05, 1.32), (0.52, -0.36, 1.25), "Arm_L", True),
        ("Hand_L", (0.52, -0.36, 1.25), (0.52, -0.60, 1.25), "Forearm_L", True),
        # Right Arm (-X): Heavy Mounted Laser Cannon
        ("Arm_R", (-0.47, 0.0, 1.64), (-0.55, -0.05, 1.32), "Spine", False),
        ("Forearm_R", (-0.55, -0.05, 1.32), (-0.52, -0.40, 1.26), "Arm_R", True),
        ("Cannon_R", (-0.52, -0.40, 1.26), (-0.52, -0.96, 1.26), "Forearm_R", True),
        # Armored Exo-Mech Legs
        ("Thigh_L", (0.215, 0.0, 1.00), (0.22, 0.0, 0.56), "Hips", False),
        ("Shin_L", (0.22, 0.0, 0.56), (0.22, 0.0, 0.16), "Thigh_L", True),
        ("Foot_L", (0.22, 0.0, 0.16), (0.22, -0.22, 0.05), "Shin_L", True),
        ("Thigh_R", (-0.215, 0.0, 1.00), (-0.22, 0.0, 0.56), "Hips", False),
        ("Shin_R", (-0.22, 0.0, 0.56), (-0.22, 0.0, 0.16), "Thigh_R", True),
        ("Foot_R", (-0.22, 0.0, 0.16), (-0.22, -0.22, 0.05), "Shin_R", True),
    ]
    arm = create_armature("DirectorVance_Armature", bone_defs)

    parts = []

    def add_part(obj, bone, outline=0.014):
        assign_rigid_weight(obj, bone)
        parts.append((obj, outline))

    def add_grad_part(obj, bone_a, bone_b, p_a, p_b, outline=0.014, blend_power=1.5):
        assign_gradient_weight(obj, bone_a, bone_b, p_a, p_b, blend_power=blend_power)
        parts.append((obj, outline))

    # =======================================================================
    # 1. BROAD ARMORED TORSO, CHESTPLATE, POWER CORE & GOLD "FBI" EMBLEMS
    # =======================================================================
    # Inner charcoal under-chassis torso (tapered V-shape heroic mech proportions)
    torso_rings = [
        {"pos": (0, 0.0, 1.02), "rx": 0.28, "ry": 0.19},
        {"pos": (0, 0.0, 1.18), "rx": 0.25, "ry": 0.18},
        {"pos": (0, 0.0, 1.38), "rx": 0.34, "ry": 0.22},
        {"pos": (0, 0.0, 1.62), "rx": 0.43, "ry": 0.25},
        {"pos": (0, 0.0, 1.77), "rx": 0.34, "ry": 0.21},
    ]
    torso_core = create_lofted_tube("Vance_Torso_Chassis", torso_rings, segs=12, mat=mat_charcoal, smooth=True)
    add_grad_part(torso_core, "Hips", "Spine", (0, 0, 1.02), (0, 0, 1.28), outline=0.016, blend_power=2.0)

    # Heavy beveled Black Chestplate Carapace
    chest_plate = create_box(
        "Vance_Chestplate",
        location=(0, -0.04, 1.54),
        size=(0.74, 0.46, 0.42),
        rot=(0.06, 0, 0),
        bevel=0.045,
        bevel_segs=1,
        mat=mat_black,
        smooth=False,
    )
    add_part(chest_plate, "Spine", outline=0.016)

    # Upper pectoral armor sloped hood + gold V-collar accent
    pec_brow = create_box(
        "Vance_Pec_Brow",
        location=(0, -0.15, 1.72),
        size=(0.66, 0.28, 0.13),
        rot=(-0.18, 0, 0),
        bevel=0.025,
        bevel_segs=1,
        mat=mat_charcoal,
        smooth=False,
    )
    add_part(pec_brow, "Spine", outline=0.012)

    chest_trim_top = create_box(
        "Vance_Chest_GoldTrimTop",
        location=(0, -0.268, 1.73),
        size=(0.56, 0.036, 0.036),
        bevel=0.006,
        mat=mat_gold,
        smooth=False,
    )
    add_part(chest_trim_top, "Spine", outline=0.0)

    for side, sx in (("L", 1), ("R", -1)):
        chest_rib = create_box(
            f"Vance_Chest_GoldRib_{side}",
            location=(sx * 0.31, -0.245, 1.54),
            size=(0.055, 0.08, 0.30),
            rot=(0.06, sx * -0.18, 0),
            bevel=0.008,
            mat=mat_gold,
            smooth=False,
        )
        add_part(chest_rib, "Spine", outline=0.0)

    # Abdominal armored plates (tiered charcoal + black)
    ab_plate = create_box(
        "Vance_Ab_Armor",
        location=(0, -0.05, 1.25),
        size=(0.48, 0.36, 0.22),
        bevel=0.028,
        bevel_segs=1,
        mat=mat_black,
        smooth=False,
    )
    add_part(ab_plate, "Spine", outline=0.013)

    # Glowing Gold Reactor Power Core on Chest + Gold Octagonal Bezel
    core_bezel = create_torus_ring(
        "Vance_Core_Bezel",
        center=(0, -0.278, 1.47),
        major_r=0.105,
        minor_r=0.024,
        major_segs=10,
        minor_segs=5,
        rot=(math.pi * 0.5 + 0.06, 0, 0),
        mat=mat_gold,
        smooth=False,
    )
    add_part(core_bezel, "Spine", outline=0.0)

    core_orb = create_uv_sphere(
        "Vance_Core_Glow",
        location=(0, -0.282, 1.47),
        scale=(0.082, 0.042, 0.082),
        segs=10,
        rings=7,
        mat=mat_core_glow,
        smooth=True,
    )
    add_part(core_orb, "Spine", outline=0.0)

    # Embossed 3D Gold "FBI" Emblem across upper Chestplate
    add_fbi_letters(
        parts,
        center=(0.0, -0.288, 1.645),
        scale_xyz=(0.20, 0.026, 0.115),
        rot_xyz=(-0.06, 0.0, 0.0),
        mat_gold=mat_gold,
        bone_name="Spine",
        prefix="ChestFBI",
    )

    # Armored Tactical Neck Collar (high fortified guard behind & beside helmet)
    collar_back = create_box(
        "Vance_NeckCollar_Back",
        location=(0, 0.11, 1.84),
        size=(0.46, 0.18, 0.18),
        bevel=0.024,
        bevel_segs=1,
        mat=mat_black,
        smooth=False,
    )
    add_part(collar_back, "Spine", outline=0.013)

    collar_gold_rim = create_box(
        "Vance_NeckCollar_GoldRim",
        location=(0, 0.11, 1.93),
        size=(0.48, 0.19, 0.032),
        bevel=0.006,
        mat=mat_gold,
        smooth=False,
    )
    add_part(collar_gold_rim, "Spine", outline=0.0)

    for side, sx in (("L", 1), ("R", -1)):
        collar_side = create_box(
            f"Vance_NeckCollar_Side_{side}",
            location=(sx * 0.22, -0.02, 1.83),
            size=(0.08, 0.24, 0.16),
            rot=(0, sx * 0.12, 0),
            bevel=0.015,
            mat=mat_charcoal,
            smooth=False,
        )
        add_part(collar_side, "Spine", outline=0.010)

    # Back Exo-Reactor Power Pack + Glowing Vents + Back "FBI" Emblem
    backpack = create_box(
        "Vance_Back_Reactor",
        location=(0, 0.26, 1.54),
        size=(0.54, 0.22, 0.44),
        bevel=0.032,
        bevel_segs=1,
        mat=mat_charcoal,
        smooth=False,
    )
    add_part(backpack, "Spine", outline=0.015)

    for side, sx in (("L", 1), ("R", -1)):
        fin = create_box(
            f"Vance_Back_Fin_{side}",
            location=(sx * 0.24, 0.32, 1.72),
            size=(0.07, 0.16, 0.26),
            rot=(-0.22, sx * -0.10, 0),
            bevel=0.012,
            mat=mat_black,
            smooth=False,
        )
        add_part(fin, "Spine", outline=0.010)

        vent_glow = create_box(
            f"Vance_Back_VentGlow_{side}",
            location=(sx * 0.16, 0.375, 1.46),
            size=(0.10, 0.025, 0.14),
            mat=mat_core_glow,
            smooth=False,
        )
        add_part(vent_glow, "Spine", outline=0.0)

    add_fbi_letters(
        parts,
        center=(0.0, 0.378, 1.62),
        scale_xyz=(0.19, 0.022, 0.105),
        rot_xyz=(0.0, 0.0, math.pi),
        mat_gold=mat_gold,
        bone_name="Spine",
        prefix="BackFBI",
    )

    # Heavy Pelvis / Armored Utility Belt / Hip Tassets
    pelvis = create_box(
        "Vance_Pelvis_Block",
        location=(0, 0.0, 1.03),
        size=(0.56, 0.38, 0.22),
        bevel=0.032,
        bevel_segs=1,
        mat=mat_black,
        smooth=False,
    )
    add_part(pelvis, "Hips", outline=0.015)

    belt_buckle = create_box(
        "Vance_Belt_Buckle",
        location=(0, -0.20, 1.09),
        size=(0.15, 0.045, 0.10),
        bevel=0.010,
        mat=mat_gold,
        smooth=False,
    )
    add_part(belt_buckle, "Hips", outline=0.0)

    for side, sx in (("L", 1), ("R", -1)):
        tasset = create_box(
            f"Vance_Hip_Tasset_{side}",
            location=(sx * 0.32, -0.02, 0.96),
            size=(0.09, 0.30, 0.24),
            rot=(0, sx * -0.18, 0),
            bevel=0.016,
            mat=mat_charcoal,
            smooth=False,
        )
        add_part(tasset, "Hips", outline=0.011)

        tasset_trim = create_box(
            f"Vance_Hip_TassetGold_{side}",
            location=(sx * 0.355, -0.02, 0.87),
            size=(0.035, 0.26, 0.038),
            mat=mat_gold,
            smooth=False,
        )
        add_part(tasset_trim, "Hips", outline=0.0)

    # =======================================================================
    # 2. HEAVY BEVELED SHOULDER PAULDRONS WITH GOLD TRIM
    # =======================================================================
    for side, sx in (("L", 1), ("R", -1)):
        b_name = f"Pauldron_{side}"
        pauldron_main = create_box(
            f"Vance_Pauldron_Main_{side}",
            location=(sx * 0.54, 0.0, 1.72),
            size=(0.34, 0.42, 0.28),
            rot=(0, sx * -0.24, 0),
            bevel=0.048,
            bevel_segs=1,
            mat=mat_black,
            smooth=False,
        )
        add_part(pauldron_main, b_name, outline=0.016)

        pauldron_cap = create_box(
            f"Vance_Pauldron_Cap_{side}",
            location=(sx * 0.57, 0.0, 1.85),
            size=(0.28, 0.34, 0.09),
            rot=(0, sx * -0.22, 0),
            bevel=0.020,
            mat=mat_charcoal,
            smooth=False,
        )
        add_part(pauldron_cap, b_name, outline=0.011)

        pauldron_gold_band = create_box(
            f"Vance_Pauldron_GoldBand_{side}",
            location=(sx * 0.67, 0.0, 1.66),
            size=(0.06, 0.40, 0.055),
            rot=(0, sx * -0.24, 0),
            bevel=0.008,
            mat=mat_gold,
            smooth=False,
        )
        add_part(pauldron_gold_band, b_name, outline=0.0)

        pauldron_crest = create_box(
            f"Vance_Pauldron_GoldCrest_{side}",
            location=(sx * 0.54, 0.0, 1.91),
            size=(0.055, 0.28, 0.06),
            rot=(0, sx * -0.20, 0),
            bevel=0.008,
            mat=mat_gold,
            smooth=False,
        )
        add_part(pauldron_crest, b_name, outline=0.0)

    # =======================================================================
    # 3. COLLARED TACTICAL HELMET / HEAD, GLOWING RED VISOR & GOLD ANTENNA
    # =======================================================================
    # Neck piston
    neck = create_cylinder(
        "Vance_Neck", (0, 0, 1.74), (0, 0, 1.89), 0.11, 0.10, segs=10, mat=mat_steel
    )
    add_part(neck, "Head", outline=0.009)

    # Stern lower face / armored jaw
    jaw_skin = create_box(
        "Vance_Face_Jaw",
        location=(0, -0.055, 1.945),
        size=(0.20, 0.21, 0.145),
        bevel=0.036,
        bevel_segs=1,
        mat=mat_skin,
        smooth=True,
    )
    add_part(jaw_skin, "Head", outline=0.011)

    mouth_scowl = create_box(
        "Vance_Scowl",
        location=(0, -0.162, 1.915),
        size=(0.075, 0.014, 0.012),
        mat=mat_black,
        smooth=False,
    )
    add_part(mouth_scowl, "Head", outline=0.0)

    # Tactical Armored Helmet Dome (tall, imposing officer silhouette)
    helmet_rings = [
        {"pos": (0, 0.01, 1.96), "rx": 0.185, "ry": 0.205},
        {"pos": (0, 0.01, 2.08), "rx": 0.195, "ry": 0.215},
        {"pos": (0, 0.015, 2.20), "rx": 0.175, "ry": 0.195},
        {"pos": (0, 0.015, 2.28), "rx": 0.115, "ry": 0.130},
        {"pos": (0, 0.015, 2.31), "rx": 0.040, "ry": 0.045},
    ]
    helmet_dome = create_lofted_tube("Vance_Helmet_Dome", helmet_rings, segs=12, mat=mat_black, smooth=True)
    add_part(helmet_dome, "Head", outline=0.014)

    # Peaked tactical officer helmet brim pointing forward (-Y)
    helmet_brim = create_box(
        "Vance_Helmet_Brim",
        location=(0, -0.185, 2.085),
        size=(0.30, 0.17, 0.036),
        rot=(0.14, 0, 0),
        bevel=0.010,
        mat=mat_black,
        smooth=False,
    )
    add_part(helmet_brim, "Head", outline=0.010)

    # Gold crown ridge & front officer emblem bar on helmet
    helmet_crest = create_box(
        "Vance_Helmet_GoldCrest",
        location=(0, 0.0, 2.295),
        size=(0.056, 0.30, 0.062),
        bevel=0.010,
        mat=mat_gold,
        smooth=False,
    )
    add_part(helmet_crest, "Head", outline=0.0)

    helmet_badge = create_box(
        "Vance_Helmet_GoldBadge",
        location=(0, -0.205, 2.155),
        size=(0.12, 0.032, 0.065),
        bevel=0.008,
        mat=mat_gold,
        smooth=False,
    )
    add_part(helmet_badge, "Head", outline=0.0)

    # Menacing Glowing Red Visor / Tactical Sunglasses (angular twin-wing wrap)
    visor_frame = create_box(
        "Vance_Visor_Frame",
        location=(0, -0.175, 2.025),
        size=(0.33, 0.085, 0.086),
        bevel=0.014,
        mat=mat_charcoal,
        smooth=False,
    )
    add_part(visor_frame, "Head", outline=0.008)

    for side, sx in (("L", 1), ("R", -1)):
        visor_lens = create_box(
            f"Vance_Visor_Red_{side}",
            location=(sx * 0.078, -0.212, 2.025),
            size=(0.135, 0.034, 0.058),
            rot=(0.0, 0.0, sx * -0.16),
            bevel=0.007,
            mat=mat_red_glow,
            smooth=False,
        )
        add_part(visor_lens, "Head", outline=0.0)

    # Gold Tactical Earpiece + Comms Antenna (Right temple, -X)
    ear_pod_r = create_box(
        "Vance_Earpiece_Pod_R",
        location=(-0.205, 0.01, 2.035),
        size=(0.055, 0.095, 0.115),
        bevel=0.012,
        mat=mat_gold,
        smooth=False,
    )
    add_part(ear_pod_r, "Head", outline=0.007)

    ear_pod_l = create_box(
        "Vance_Earpiece_Pod_L",
        location=(0.205, 0.01, 2.035),
        size=(0.048, 0.088, 0.105),
        bevel=0.010,
        mat=mat_charcoal,
        smooth=False,
    )
    add_part(ear_pod_l, "Head", outline=0.007)

    antenna_rod = create_cylinder(
        "Vance_Antenna_Rod",
        (-0.22, 0.02, 2.09),
        (-0.24, 0.04, 2.38),
        0.014,
        0.009,
        segs=7,
        mat=mat_gold,
    )
    add_part(antenna_rod, "Head", outline=0.0)

    antenna_tip = create_uv_sphere(
        "Vance_Antenna_Beacon",
        location=(-0.242, 0.042, 2.392),
        scale=(0.024, 0.024, 0.024),
        segs=8,
        rings=6,
        mat=mat_red_glow,
    )
    add_part(antenna_tip, "Head", outline=0.0)

    # =======================================================================
    # 4. RIGHT ARM (-X): HEAVY MOUNTED LASER CANNON WITH GLOWING RED EMITTER
    # =======================================================================
    # Upper arm armor + elbow hydraulic joint
    r_bicep = create_cylinder(
        "Vance_ArmR_Bicep",
        (-0.47, 0.0, 1.62),
        (-0.55, -0.05, 1.34),
        0.105,
        0.092,
        segs=10,
        mat=mat_charcoal,
    )
    add_grad_part(r_bicep, "Spine", "Arm_R", (-0.42, 0, 1.64), (-0.50, -0.02, 1.54), outline=0.012)

    r_elbow = create_uv_sphere(
        "Vance_ArmR_Elbow",
        location=(-0.55, -0.05, 1.32),
        scale=(0.095, 0.095, 0.095),
        segs=8,
        rings=6,
        mat=mat_steel,
    )
    add_part(r_elbow, "Forearm_R", outline=0.010)

    # Forearm exo-brace connecting into the heavy Laser Cannon housing
    r_forearm = create_box(
        "Vance_Cannon_Housing",
        location=(-0.53, -0.34, 1.26),
        size=(0.24, 0.44, 0.24),
        bevel=0.032,
        bevel_segs=1,
        mat=mat_black,
        smooth=False,
    )
    add_part(r_forearm, "Forearm_R", outline=0.014)

    r_housing_gold = create_box(
        "Vance_Cannon_GoldRail",
        location=(-0.53, -0.34, 1.385),
        size=(0.14, 0.36, 0.045),
        bevel=0.008,
        mat=mat_gold,
        smooth=False,
    )
    add_part(r_housing_gold, "Forearm_R", outline=0.0)

    r_charge_cell = create_cylinder(
        "Vance_Cannon_ChargeCell",
        (-0.655, -0.24, 1.28),
        (-0.655, -0.46, 1.28),
        0.040,
        0.040,
        segs=8,
        mat=mat_red_glow,
    )
    add_part(r_charge_cell, "Forearm_R", outline=0.0)

    # Heavy Mounted Laser Cannon Barrel (attached to Cannon_R for recoil/glow)
    cannon_barrel = create_cylinder(
        "Vance_Laser_Barrel",
        (-0.52, -0.54, 1.26),
        (-0.52, -0.96, 1.26),
        0.082,
        0.068,
        segs=10,
        mat=mat_steel,
    )
    add_part(cannon_barrel, "Cannon_R", outline=0.012)

    cannon_shroud = create_box(
        "Vance_Laser_Shroud",
        location=(-0.52, -0.70, 1.26),
        size=(0.18, 0.26, 0.14),
        bevel=0.018,
        mat=mat_charcoal,
        smooth=False,
    )
    add_part(cannon_shroud, "Cannon_R", outline=0.010)

    cannon_muzzle = create_cylinder(
        "Vance_Laser_Muzzle",
        (-0.52, -0.93, 1.26),
        (-0.52, -1.03, 1.26),
        0.094,
        0.102,
        segs=10,
        mat=mat_gold,
    )
    add_part(cannon_muzzle, "Cannon_R", outline=0.008)

    cannon_emitter = create_uv_sphere(
        "Vance_Laser_EmitterTip",
        location=(-0.52, -1.035, 1.26),
        scale=(0.072, 0.048, 0.072),
        segs=10,
        rings=6,
        mat=mat_red_glow,
    )
    add_part(cannon_emitter, "Cannon_R", outline=0.0)

    # =======================================================================
    # 5. LEFT ARM (+X): NET LAUNCHER GAUNTLET WITH ENERGY RINGS
    # =======================================================================
    l_bicep = create_cylinder(
        "Vance_ArmL_Bicep",
        (0.47, 0.0, 1.62),
        (0.55, -0.05, 1.34),
        0.105,
        0.092,
        segs=10,
        mat=mat_charcoal,
    )
    add_grad_part(l_bicep, "Spine", "Arm_L", (0.42, 0, 1.64), (0.50, -0.02, 1.54), outline=0.012)

    l_elbow = create_uv_sphere(
        "Vance_ArmL_Elbow",
        location=(0.55, -0.05, 1.32),
        scale=(0.095, 0.095, 0.095),
        segs=8,
        rings=6,
        mat=mat_steel,
    )
    add_part(l_elbow, "Forearm_L", outline=0.010)

    # Chunky Net Launcher Gauntlet body
    l_gauntlet = create_box(
        "Vance_NetGauntlet_Body",
        location=(0.53, -0.28, 1.25),
        size=(0.23, 0.36, 0.22),
        bevel=0.030,
        bevel_segs=1,
        mat=mat_black,
        smooth=False,
    )
    add_part(l_gauntlet, "Forearm_L", outline=0.014)

    l_gauntlet_trim = create_box(
        "Vance_NetGauntlet_GoldPlate",
        location=(0.648, -0.28, 1.25),
        size=(0.036, 0.28, 0.12),
        bevel=0.008,
        mat=mat_gold,
        smooth=False,
    )
    add_part(l_gauntlet_trim, "Forearm_L", outline=0.0)

    # Projector cylinder + 3 glowing energy rings + dual emitter prongs (Hand_L)
    net_nozzle = create_cylinder(
        "Vance_Net_Nozzle",
        (0.52, -0.45, 1.25),
        (0.52, -0.72, 1.25),
        0.095,
        0.115,
        segs=10,
        mat=mat_steel,
    )
    add_part(net_nozzle, "Hand_L", outline=0.011)

    for idx, (ny, nr) in enumerate(((-0.50, 0.118), (-0.59, 0.126), (-0.68, 0.134))):
        ring = create_torus_ring(
            f"Vance_Net_EnergyRing_{idx}",
            center=(0.52, ny, 1.25),
            major_r=nr,
            minor_r=0.018,
            major_segs=10,
            minor_segs=5,
            rot=(math.pi * 0.5, 0, 0),
            mat=mat_net_glow,
            smooth=True,
        )
        add_part(ring, "Hand_L", outline=0.0)

    for side_idx, sx_off in ((-1, -0.105), (1, 0.105)):
        prong = create_box(
            f"Vance_Net_Prong_{side_idx}",
            location=(0.52 + sx_off, -0.66, 1.25),
            size=(0.042, 0.22, 0.068),
            bevel=0.008,
            mat=mat_black,
            smooth=False,
        )
        add_part(prong, "Hand_L", outline=0.007)

    net_core = create_uv_sphere(
        "Vance_Net_Core",
        location=(0.52, -0.72, 1.25),
        scale=(0.072, 0.036, 0.072),
        segs=8,
        rings=6,
        mat=mat_net_glow,
    )
    add_part(net_core, "Hand_L", outline=0.0)

    # =======================================================================
    # 6. ARMORED EXO-MECH LEGS & HEAVY BOOTS (PLANTED CLEANLY ON Z = 0.0)
    # =======================================================================
    for side, sx in (("L", 1), ("R", -1)):
        # Armored Thigh
        thigh_inner = create_cylinder(
            f"Vance_Thigh_Core_{side}",
            (sx * 0.215, 0.0, 0.98),
            (sx * 0.22, 0.0, 0.57),
            0.130,
            0.112,
            segs=10,
            mat=mat_charcoal,
        )
        add_grad_part(
            thigh_inner,
            "Hips",
            f"Thigh_{side}",
            (sx * 0.215, 0, 1.00),
            (sx * 0.215, 0, 0.86),
            outline=0.013,
        )

        thigh_plate = create_box(
            f"Vance_Thigh_Plate_{side}",
            location=(sx * 0.225, -0.02, 0.78),
            size=(0.25, 0.26, 0.34),
            bevel=0.030,
            bevel_segs=1,
            mat=mat_black,
            smooth=False,
        )
        add_part(thigh_plate, f"Thigh_{side}", outline=0.013)

        # Gold-trimmed Knee Guard
        knee_guard = create_box(
            f"Vance_Knee_Guard_{side}",
            location=(sx * 0.22, -0.145, 0.56),
            size=(0.19, 0.12, 0.17),
            rot=(-0.12, 0, 0),
            bevel=0.022,
            bevel_segs=1,
            mat=mat_gold,
            smooth=False,
        )
        add_part(knee_guard, f"Shin_{side}", outline=0.009)

        # Heavy Exo-Mech Shin Greave
        shin_greave = create_box(
            f"Vance_Shin_Greave_{side}",
            location=(sx * 0.22, -0.01, 0.35),
            size=(0.24, 0.27, 0.36),
            bevel=0.030,
            bevel_segs=1,
            mat=mat_black,
            smooth=False,
        )
        add_part(shin_greave, f"Shin_{side}", outline=0.014)

        calf_piston = create_cylinder(
            f"Vance_Calf_Piston_{side}",
            (sx * 0.22, 0.145, 0.52),
            (sx * 0.22, 0.135, 0.19),
            0.038,
            0.034,
            segs=7,
            mat=mat_steel,
        )
        add_part(calf_piston, f"Shin_{side}", outline=0.006)

        # Heavy Flat-Planted Exo-Mech Boot (bottom at Z = 0.000)
        boot_sole = create_box(
            f"Vance_Boot_Sole_{side}",
            location=(sx * 0.22, -0.065, 0.045),
            size=(0.27, 0.42, 0.09),
            bevel=0.012,
            bevel_segs=1,
            mat=mat_charcoal,
            smooth=False,
        )
        add_part(boot_sole, f"Foot_{side}", outline=0.011)

        boot_upper = create_box(
            f"Vance_Boot_Upper_{side}",
            location=(sx * 0.22, -0.055, 0.135),
            size=(0.24, 0.34, 0.12),
            bevel=0.024,
            bevel_segs=1,
            mat=mat_black,
            smooth=False,
        )
        add_part(boot_upper, f"Foot_{side}", outline=0.012)

        boot_toecap = create_box(
            f"Vance_Boot_GoldToe_{side}",
            location=(sx * 0.22, -0.225, 0.088),
            size=(0.21, 0.095, 0.085),
            rot=(0.15, 0, 0),
            bevel=0.014,
            mat=mat_gold,
            smooth=False,
        )
        add_part(boot_toecap, f"Foot_{side}", outline=0.0)

    # Apply inverted-hull outlines & join into single skinned mesh
    vance_mesh = apply_outlines_and_join(parts, mat_outline, "DirectorVance_Mesh", arm)

    # =======================================================================
    # 7. ANIMATIONS (ALL 6 REQUIRED CLIPS PUSHED TO NLA TRACKS)
    #    Idle, Walk, Laser_Sweep, Net_Shot, Stunned, Defeat
    # =======================================================================

    # 1. Idle (1..60, looping): Imposing heavy mech breathing heave & scan
    def anim_idle(a):
        keys = [
            # frame, hip_z, spine_x, head_z, pauld_y, armR_x, armL_x
            (1, 0.0, 2, -6, 0, 14, 12),
            (15, 0.028, -2, 0, 5, 18, 16),
            (30, 0.0, 3, 8, 0, 14, 12),
            (45, 0.028, -2, 2, 5, 17, 15),
            (60, 0.0, 2, -6, 0, 14, 12),
        ]
        for f, hz, sx, hdz, py, arx, alx in keys:
            kf_bone(a, "Hips", f, rot_deg=(0, 0, 0), loc=(0, 0, hz))
            kf_bone(a, "Spine", f, rot_deg=(sx, 0, 0))
            kf_bone(a, "Head", f, rot_deg=(-2, 0, hdz))
            kf_bone(a, "Pauldron_L", f, rot_deg=(0, -py, 0))
            kf_bone(a, "Pauldron_R", f, rot_deg=(0, py, 0))
            kf_bone(a, "Arm_R", f, rot_deg=(arx, 0, 6))
            kf_bone(a, "Forearm_R", f, rot_deg=(12, 0, 4))
            kf_bone(a, "Arm_L", f, rot_deg=(alx, 0, -6))
            kf_bone(a, "Forearm_L", f, rot_deg=(14, 0, -4))
            kf_bone(a, "Thigh_L", f, rot_deg=(3, 0, -4))
            kf_bone(a, "Thigh_R", f, rot_deg=(3, 0, 4))

    push_action_to_nla(arm, "Idle", anim_idle, 1, 60)

    # 2. Walk (1..36, looping): Heavy stomping exo-mech march
    def anim_walk(a):
        keys = [
            # frame, hip_z, hip_yaw, hip_roll, thighL, shinL, thighR, shinR, armL, armR
            (1, -0.02, -7, -3, 28, -16, -22, 8, -12, 18),
            (10, 0.045, 0, 0, 4, -34, 4, -6, 4, 14),
            (19, -0.02, 7, 3, -22, 8, 28, -16, 22, 10),
            (28, 0.045, 0, 0, 4, -6, 4, -34, 4, 14),
            (36, -0.02, -7, -3, 28, -16, -22, 8, -12, 18),
        ]
        for f, hz, hy, hr, tl, sl, tr, sr, alx, arx in keys:
            kf_bone(a, "Hips", f, rot_deg=(5, hr, hy), loc=(0, 0, hz))
            kf_bone(a, "Spine", f, rot_deg=(6, -hr * 0.6, -hy * 0.7))
            kf_bone(a, "Head", f, rot_deg=(-6, 0, -hy * 0.3))
            kf_bone(a, "Pauldron_L", f, rot_deg=(0, -3 if hz > 0 else 2, 0))
            kf_bone(a, "Pauldron_R", f, rot_deg=(0, 3 if hz > 0 else -2, 0))
            kf_bone(a, "Thigh_L", f, rot_deg=(tl, 0, 0))
            kf_bone(a, "Shin_L", f, rot_deg=(sl, 0, 0))
            kf_bone(a, "Foot_L", f, rot_deg=(-sl * 0.35, 0, 0))
            kf_bone(a, "Thigh_R", f, rot_deg=(tr, 0, 0))
            kf_bone(a, "Shin_R", f, rot_deg=(sr, 0, 0))
            kf_bone(a, "Foot_R", f, rot_deg=(-sr * 0.35, 0, 0))
            kf_bone(a, "Arm_L", f, rot_deg=(alx, 0, -8))
            kf_bone(a, "Forearm_L", f, rot_deg=(18, 0, 0))
            kf_bone(a, "Arm_R", f, rot_deg=(arx, 0, 8))
            kf_bone(a, "Forearm_R", f, rot_deg=(14, 0, 6))

    push_action_to_nla(arm, "Walk", anim_walk, 1, 36)

    # 3. Laser_Sweep (1..48): Charge cannon -> sweep beam across 70 deg -> recover
    def anim_laser_sweep(a):
        poses = [
            # frame, hip_z, spine_x, spine_z, armR_x, armR_z, cannon_x, armL_x
            (1, 0.0, 2, 0, 16, 6, 0, 12),
            (12, -0.07, 10, -34, 68, -18, 6, -10),   # Telegraph charge aimed right
            (22, -0.06, 6, -12, 74, -4, -4, -8),     # Firing sweep start
            (34, -0.06, 6, 36, 74, 24, -4, -14),     # Sweeping 70 deg across left
            (42, -0.03, 4, 18, 48, 14, 0, 4),        # Follow-through
            (48, 0.0, 2, 0, 16, 6, 0, 12),           # Return to ready
        ]
        for f, hz, sx, sz, arx, arz, cx, alx in poses:
            kf_bone(a, "Hips", f, rot_deg=(4, 0, sz * 0.25), loc=(0, 0, hz))
            kf_bone(a, "Spine", f, rot_deg=(sx, 0, sz))
            kf_bone(a, "Head", f, rot_deg=(-4, 0, -sz * 0.25))
            kf_bone(a, "Pauldron_R", f, rot_deg=(0, 10 if f in (12, 22, 34) else 0, 0))
            kf_bone(a, "Pauldron_L", f, rot_deg=(0, -6 if f in (12, 22, 34) else 0, 0))
            kf_bone(a, "Arm_R", f, rot_deg=(arx, 0, arz))
            kf_bone(a, "Forearm_R", f, rot_deg=(12, 0, 8))
            kf_bone(a, "Cannon_R", f, rot_deg=(cx, 0, 0))
            kf_bone(a, "Arm_L", f, rot_deg=(alx, 0, -14))
            kf_bone(a, "Forearm_L", f, rot_deg=(24, 0, -10))
            kf_bone(a, "Thigh_L", f, rot_deg=(14 if hz < -0.02 else 3, 0, -5))
            kf_bone(a, "Shin_L", f, rot_deg=(-18 if hz < -0.02 else 0, 0, 0))
            kf_bone(a, "Thigh_R", f, rot_deg=(-10 if hz < -0.02 else 3, 0, 5))
            kf_bone(a, "Shin_R", f, rot_deg=(-14 if hz < -0.02 else 0, 0, 0))

    push_action_to_nla(arm, "Laser_Sweep", anim_laser_sweep, 1, 48)

    # 4. Net_Shot (1..36): Thrust Left Net Launcher gauntlet -> energy recoil -> recover
    def anim_net_shot(a):
        poses = [
            # frame, hip_z, spine_x, spine_z, armL_x, farmL_x, handL_x, armR_x
            (1, 0.0, 2, 0, 14, 14, 0, 14),
            (10, -0.05, 8, 20, 68, 16, 0, -4),       # Aim left gauntlet forward
            (16, -0.02, -10, 28, 86, 26, -12, -14),  # Launch burst + recoil kickback!
            (24, -0.04, 4, 12, 54, 16, 0, 4),        # Recover
            (36, 0.0, 2, 0, 14, 14, 0, 14),
        ]
        for f, hz, sx, sz, alx, flx, hlx, arx in poses:
            kf_bone(a, "Hips", f, rot_deg=(2, 0, sz * 0.3), loc=(0, 0, hz))
            kf_bone(a, "Spine", f, rot_deg=(sx, 0, sz))
            kf_bone(a, "Head", f, rot_deg=(-6, 0, -sz * 0.4))
            kf_bone(a, "Pauldron_L", f, rot_deg=(0, -12 if f in (10, 16) else 0, 0))
            kf_bone(a, "Arm_L", f, rot_deg=(alx, 0, -10))
            kf_bone(a, "Forearm_L", f, rot_deg=(flx, 0, -12))
            kf_bone(a, "Hand_L", f, rot_deg=(hlx, 0, 0))
            kf_bone(a, "Arm_R", f, rot_deg=(arx, 0, 14))
            kf_bone(a, "Forearm_R", f, rot_deg=(18, 0, 6))
            kf_bone(a, "Thigh_L", f, rot_deg=(-12 if f in (10, 16) else 3, 0, -4))
            kf_bone(a, "Thigh_R", f, rot_deg=(14 if f in (10, 16) else 3, 0, 4))

    push_action_to_nla(arm, "Net_Shot", anim_net_shot, 1, 36)

    # 5. Stunned (1..48, looping): Shield overloaded! Hunched, sparking, twitching
    def anim_stunned(a):
        keys = [
            # frame, hip_z, spine_x, spine_y, head_x, head_y, armL_x, armR_x
            (1, -0.10, 24, -6, 26, -12, -22, -26),
            (12, -0.12, 30, 8, 34, 14, -30, -18),
            (24, -0.09, 22, -10, 24, -14, -18, -32),
            (36, -0.13, 32, 6, 36, 10, -28, -22),
            (48, -0.10, 24, -6, 26, -12, -22, -26),
        ]
        for f, hz, sx, sy, hx, hy, alx, arx in keys:
            kf_bone(a, "Hips", f, rot_deg=(8, sy * 0.4, 0), loc=(0, 0, hz))
            kf_bone(a, "Spine", f, rot_deg=(sx, sy, 0))
            kf_bone(a, "Head", f, rot_deg=(hx, hy, sy * 0.8))
            kf_bone(a, "Pauldron_L", f, rot_deg=(10, 8, 0))
            kf_bone(a, "Pauldron_R", f, rot_deg=(10, -8, 0))
            kf_bone(a, "Arm_L", f, rot_deg=(alx, 12, 14))
            kf_bone(a, "Forearm_L", f, rot_deg=(-12, 0, 6))
            kf_bone(a, "Arm_R", f, rot_deg=(arx, -12, -14))
            kf_bone(a, "Forearm_R", f, rot_deg=(-14, 0, -6))
            kf_bone(a, "Thigh_L", f, rot_deg=(20, 0, -6))
            kf_bone(a, "Shin_L", f, rot_deg=(-28, 0, 0))
            kf_bone(a, "Thigh_R", f, rot_deg=(20, 0, 6))
            kf_bone(a, "Shin_R", f, rot_deg=(-28, 0, 0))

    push_action_to_nla(arm, "Stunned", anim_stunned, 1, 48)

    # 6. Defeat (1..60, non-looping collapse): Short-circuit stagger -> kneel -> slump down!
    def anim_defeat(a):
        poses = [
            # frame, hip_z, hip_rot, spine_rot, head_rot, thighL, shinL, thighR, shinR, armL, armR
            (1, 0.0, (0, 0, 0), (4, 0, 0), (0, 0, 0), 3, 0, 3, 0, (12, 0, -6), (14, 0, 6)),
            (14, -0.06, (-10, 8, -12), (-14, 12, -10), (-18, 14, 8), 16, -20, -10, -12, (-35, 15, -28), (-28, -12, 26)),
            (30, -0.34, (14, -6, 6), (26, -8, 8), (30, -12, 6), 58, -82, 46, -72, (-42, 10, 12), (-46, -10, -12)),
            (46, -0.52, (26, -12, 10), (46, -14, 14), (48, -18, 12), 78, -112, 68, -104, (-52, 16, 18), (-56, -16, -20)),
            (60, -0.56, (30, -14, 12), (54, -16, 16), (56, -20, 14), 82, -118, 72, -108, (-56, 18, 22), (-60, -18, -22)),
        ]
        for f, hz, hrot, srot, hdrot, tl, sl, tr, sr, al, ar in poses:
            kf_bone(a, "Hips", f, rot_deg=hrot, loc=(0, 0, hz))
            kf_bone(a, "Spine", f, rot_deg=srot)
            kf_bone(a, "Head", f, rot_deg=hdrot)
            kf_bone(a, "Pauldron_L", f, rot_deg=(12 if f >= 30 else 0, 10 if f >= 30 else 0, 0))
            kf_bone(a, "Pauldron_R", f, rot_deg=(12 if f >= 30 else 0, -10 if f >= 30 else 0, 0))
            kf_bone(a, "Thigh_L", f, rot_deg=(tl, 0, -8))
            kf_bone(a, "Shin_L", f, rot_deg=(sl, 0, 0))
            kf_bone(a, "Foot_L", f, rot_deg=(28 if f >= 30 else 0, 0, 0))
            kf_bone(a, "Thigh_R", f, rot_deg=(tr, 0, 8))
            kf_bone(a, "Shin_R", f, rot_deg=(sr, 0, 0))
            kf_bone(a, "Foot_R", f, rot_deg=(28 if f >= 30 else 0, 0, 0))
            kf_bone(a, "Arm_L", f, rot_deg=al)
            kf_bone(a, "Forearm_L", f, rot_deg=(-16 if f >= 30 else 14, 0, 0))
            kf_bone(a, "Arm_R", f, rot_deg=ar)
            kf_bone(a, "Forearm_R", f, rot_deg=(-20 if f >= 30 else 12, 0, 0))

    push_action_to_nla(arm, "Defeat", anim_defeat, 1, 60)

    export_glb(VANCE_GLB, [arm, vance_mesh])
    return inspect_glb(VANCE_GLB)


def main():
    print("=== EXOTIC-016: Building FBI Director Vance Exo-Mech Boss ===")
    tris, anims, mats, min_y, max_y = build_director_vance()
    expected_anims = {"Idle", "Walk", "Laser_Sweep", "Net_Shot", "Stunned", "Defeat"}
    missing = expected_anims - set(anims)
    outline_mats = [m for m in mats if "outline" in m[0].lower()]

    assert 3000 <= tris <= 8000, f"Triangle count {tris} outside 3,000..8,000 budget!"
    assert not missing, f"Missing animations: {missing}"
    assert outline_mats and all(not ds for _, ds in outline_mats), f"Outline must have doubleSided=False: {outline_mats}"
    assert abs(min_y) < 0.02, f"Feet must rest on ground (min_y={min_y})"
    assert 2.15 <= max_y <= 2.55, f"Height should be ~2.2-2.4m (max_y={max_y})"

    print("=== EXOTIC-016 Director Vance Model Verified OK ===")


if __name__ == "__main__":
    main()
