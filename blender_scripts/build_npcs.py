"""
EXOTIC-004: Blender Python script to build, rig, animate, and export
Smuff (public/models/smuff.glb, ~4,800 tris) and
FBI Agent (public/models/fbi_agent.glb, ~5,000 tris).

Run headless:
    blender --background --python blender_scripts/build_npcs.py
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
SMUFF_GLB = os.path.join(MODELS_DIR, "smuff.glb")
FBI_GLB = os.path.join(MODELS_DIR, "fbi_agent.glb")


# ---------------------------------------------------------------------------
# Shared Helpers
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
    roughness=0.82,
    metallic=0.0,
    specular=0.22,
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
    mat = make_toon_mat(
        "Outline_Black",
        "#0C0C10",
        roughness=1.0,
        metallic=0.0,
        specular=0.0,
        backface_culling=True,
    )
    return mat


def finish_bmesh_obj(name, bm, mat, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()

    # Create clean box-projected UVs so every vertex has valid texcoords for glTF
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

    if smooth:
        mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))
    else:
        mesh.polygons.foreach_set("use_smooth", [False] * len(mesh.polygons))

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def create_uv_sphere(
    name,
    location=(0, 0, 0),
    scale=(1, 1, 1),
    rot=(0, 0, 0),
    segs=14,
    rings=10,
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


def create_capsule(
    name,
    p0,
    p1,
    r0,
    r1=None,
    segs=10,
    mid_rings=2,
    cap_rings=2,
    mat=None,
    smooth=True,
):
    """Smooth tapered capsule between p0 and p1 with hemispherical caps."""
    if r1 is None:
        r1 = r0
    v0 = Vector(p0)
    v1 = Vector(p1)
    axis = v1 - v0
    length = axis.length
    if length < 1e-6:
        length = 1e-4
        axis = Vector((0, 0, 1))
    z_dir = axis.normalized()
    quat = Vector((0, 0, 1)).rotation_difference(z_dir)

    rings_data = []
    # Bottom hemisphere (excluding pole)
    for i in range(1, cap_rings + 1):
        ang = -math.pi * 0.5 + (math.pi * 0.5) * (i / cap_rings)
        z = -length * 0.5 + math.sin(ang) * r0
        r = max(1e-4, math.cos(ang) * r0)
        rings_data.append((z, r))
    # Shaft rings
    for i in range(1, mid_rings):
        t = i / mid_rings
        z = -length * 0.5 + t * length
        r = r0 * (1.0 - t) + r1 * t
        rings_data.append((z, r))
    # Top hemisphere
    for i in range(0, cap_rings):
        ang = (math.pi * 0.5) * (i / cap_rings)
        z = length * 0.5 + math.sin(ang) * r1
        r = max(1e-4, math.cos(ang) * r1)
        rings_data.append((z, r))

    bm = bmesh.new()
    bottom_pole = bm.verts.new((0, 0, -length * 0.5 - r0))
    top_pole = bm.verts.new((0, 0, length * 0.5 + r1))

    ring_verts = []
    for z, r in rings_data:
        rv = []
        for s in range(segs):
            a = 2.0 * math.pi * s / segs
            rv.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, z)))
        ring_verts.append(rv)

    # Bottom cap fan
    first_ring = ring_verts[0]
    for s in range(segs):
        s_next = (s + 1) % segs
        bm.faces.new((bottom_pole, first_ring[s_next], first_ring[s]))

    # Side quads
    for ri in range(len(ring_verts) - 1):
        r_a = ring_verts[ri]
        r_b = ring_verts[ri + 1]
        for s in range(segs):
            s_next = (s + 1) % segs
            bm.faces.new((r_a[s], r_a[s_next], r_b[s_next], r_b[s]))

    # Top cap fan
    last_ring = ring_verts[-1]
    for s in range(segs):
        s_next = (s + 1) % segs
        bm.faces.new((top_pole, last_ring[s], last_ring[s_next]))

    mid = (v0 + v1) * 0.5
    mat4 = Matrix.Translation(mid) @ quat.to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=mat4, verts=bm.verts)
    return finish_bmesh_obj(name, bm, mat, smooth=smooth)


def create_lofted_tube(
    name,
    ring_specs,
    segs=14,
    mat=None,
    cap_start=True,
    cap_end=True,
    smooth=True,
):
    """
    ring_specs: list of dicts with keys:
      pos: (x, y, z)
      rx: radius along local X
      ry: radius along local Y
      rot: (rx, ry, rz) euler in radians (optional)
    """
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
    """Smoothly blend vertex weights from bone_a (at p_a) to bone_b (at p_b)."""
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
            # Smoothstep-like curve
            t = t * t * (3.0 - 2.0 * t)
        w_b = t
        w_a = 1.0 - t
        if w_a > 1e-4:
            vg_a.add([v.index], w_a, "REPLACE")
        if w_b > 1e-4:
            vg_b.add([v.index], w_b, "REPLACE")


def apply_outlines_and_join(parts_with_outline, outline_mat, final_name, armature_obj):
    """
    parts_with_outline: list of (obj, outline_thickness)
    Applies Solidify inverted-hull outline BEFORE joining so each part can have
    tailored outline thickness (or 0.0 for fine details) and outline vertices
    inherit the exact vertex group weights.
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

    # Parent to armature and add Armature modifier
    merged.parent = armature_obj
    arm_mod = merged.modifiers.new(name="Armature", type="ARMATURE")
    arm_mod.object = armature_obj
    arm_mod.use_vertex_groups = True

    return merged


def create_armature(name, bone_defs):
    """
    bone_defs: list of (bone_name, head, tail, parent_name, use_connect)
    """
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
    """Parse GLB JSON chunk to verify triangle count, materials, and animations."""
    with open(filepath, "rb") as f:
        magic, version, length = struct.unpack("<4sII", f.read(12))
        chunk_len, chunk_type = struct.unpack("<II", f.read(8))
        gltf = json.loads(f.read(chunk_len).decode("utf-8"))

    accessors = gltf.get("accessors", [])
    total_tris = 0
    for mesh in gltf.get("meshes", []):
        for prim in mesh.get("primitives", []):
            if "indices" in prim:
                total_tris += accessors[prim["indices"]]["count"] // 3
            else:
                pos_acc = prim["attributes"]["POSITION"]
                total_tris += accessors[pos_acc]["count"] // 3

    anims = [a.get("name", "<unnamed>") for a in gltf.get("animations", [])]
    mats = [
        (m.get("name", "<unnamed>"), m.get("doubleSided", False))
        for m in gltf.get("materials", [])
    ]
    size_kb = os.path.getsize(filepath) / 1024.0
    print(f"[VERIFY] {os.path.basename(filepath)} ({size_kb:.1f} KB)")
    print(f"  Triangles : {total_tris}")
    print(f"  Materials : {mats}")
    print(f"  Animations: {anims}")
    return total_tris, anims, mats


# ===========================================================================
# 1. SMUFF (public/models/smuff.glb, ~4,800 tris)
# ===========================================================================
def build_smuff():
    reset_scene()

    # Materials matching references/characters_ref.png
    mat_blue = make_toon_mat("Smuff_Skin_Blue", "#1F8CE8", roughness=0.80, specular=0.22)
    mat_blue_ear = make_toon_mat("Smuff_Ear_Inner", "#1268BD", roughness=0.88, specular=0.12)
    mat_white = make_toon_mat("Smuff_White", "#F2F6FC", roughness=0.82, specular=0.18)
    mat_eye_white = make_toon_mat("Smuff_Eye_White", "#FFFFFF", roughness=0.35, specular=0.45)
    mat_pupil = make_toon_mat("Smuff_Pupil", "#14161D", roughness=0.20, specular=0.60)
    mat_smile = make_toon_mat("Smuff_Mouth", "#0F2B4C", roughness=0.90, specular=0.05)
    mat_outline = make_outline_mat()

    # Armature (character faces -Y in Blender -> +Z in Three.js, feet on Z=0)
    bone_defs = [
        ("Root", (0, 0, 0.0), (0, 0, 0.28), None, False),
        ("Hips", (0, 0, 0.28), (0, 0, 0.43), "Root", False),
        ("Spine", (0, 0, 0.43), (0, 0, 0.62), "Hips", True),
        ("Head", (0, 0, 0.62), (0, 0, 0.92), "Spine", True),
        ("Cap_Tip", (0, 0, 0.92), (0.08, -0.06, 1.15), "Head", False),
        ("Arm_L", (0.20, 0.0, 0.56), (0.29, -0.01, 0.43), "Spine", False),
        ("Forearm_L", (0.29, -0.01, 0.43), (0.35, -0.05, 0.27), "Arm_L", True),
        ("Arm_R", (-0.20, 0.0, 0.56), (-0.29, -0.01, 0.43), "Spine", False),
        ("Forearm_R", (-0.29, -0.01, 0.43), (-0.35, -0.05, 0.27), "Arm_R", True),
        ("Leg_L", (0.125, 0.0, 0.30), (0.125, 0.0, 0.12), "Hips", False),
        ("Foot_L", (0.125, 0.0, 0.12), (0.135, -0.14, 0.05), "Leg_L", True),
        ("Leg_R", (-0.125, 0.0, 0.30), (-0.125, 0.0, 0.12), "Hips", False),
        ("Foot_R", (-0.125, 0.0, 0.12), (-0.135, -0.14, 0.05), "Leg_R", True),
    ]
    arm = create_armature("Smuff_Armature", bone_defs)

    parts = []

    # --- Head ---
    head = create_uv_sphere(
        "Smuff_Head",
        location=(0, -0.005, 0.775),
        scale=(0.242, 0.225, 0.212),
        segs=14,
        rings=10,
        mat=mat_blue,
    )
    assign_rigid_weight(head, "Head")
    parts.append((head, 0.012))

    # --- Bulbous Blue Nose ---
    nose = create_uv_sphere(
        "Smuff_Nose",
        location=(0, -0.252, 0.735),
        scale=(0.072, 0.076, 0.062),
        segs=10,
        rings=7,
        mat=mat_blue,
    )
    assign_rigid_weight(nose, "Head")
    parts.append((nose, 0.008))

    # --- Rounded Ears (Left & Right) ---
    for side, sx in (("L", 1), ("R", -1)):
        ear = create_uv_sphere(
            f"Smuff_Ear_{side}",
            location=(sx * 0.242, 0.015, 0.755),
            scale=(0.062, 0.036, 0.072),
            rot=(0.08, sx * -0.28, sx * 0.18),
            segs=9,
            rings=6,
            mat=mat_blue,
        )
        assign_rigid_weight(ear, "Head")
        parts.append((ear, 0.008))

        ear_in = create_uv_sphere(
            f"Smuff_EarIn_{side}",
            location=(sx * 0.246, -0.004, 0.753),
            scale=(0.038, 0.018, 0.044),
            rot=(0.08, sx * -0.28, sx * 0.18),
            segs=8,
            rings=5,
            mat=mat_blue_ear,
        )
        assign_rigid_weight(ear_in, "Head")
        parts.append((ear_in, 0.0))

    # --- Expressive Tall-Oval Eyes + Pupils + Highlights ---
    for side, sx in (("L", 1), ("R", -1)):
        eye = create_uv_sphere(
            f"Smuff_Eye_{side}",
            location=(sx * 0.066, -0.202, 0.808),
            scale=(0.056, 0.035, 0.078),
            rot=(0.0, 0.0, sx * -0.14),
            segs=10,
            rings=7,
            mat=mat_eye_white,
        )
        assign_rigid_weight(eye, "Head")
        parts.append((eye, 0.005))

        pupil = create_uv_sphere(
            f"Smuff_Pupil_{side}",
            location=(sx * 0.060, -0.233, 0.802),
            scale=(0.025, 0.016, 0.036),
            segs=8,
            rings=5,
            mat=mat_pupil,
        )
        assign_rigid_weight(pupil, "Head")
        parts.append((pupil, 0.0))

        shine = create_uv_sphere(
            f"Smuff_EyeShine_{side}",
            location=(sx * 0.069, -0.244, 0.818),
            scale=(0.009, 0.006, 0.011),
            segs=6,
            rings=4,
            mat=mat_eye_white,
        )
        assign_rigid_weight(shine, "Head")
        parts.append((shine, 0.0))

    # --- Cute Curved Smile ---
    smile_rings = []
    for i in range(7):
        t = (i / 6.0) * 2.0 - 1.0  # -1..+1
        x = t * 0.095
        y = -0.222 + (t * t) * 0.032
        z = 0.655 + (t * t) * 0.024
        r = 0.0095 * (1.0 - 0.25 * abs(t))
        smile_rings.append(
            {"pos": (x, y, z), "rx": r, "ry": r, "rot": (0.0, math.pi * 0.5, 0.0)}
        )
    smile = create_lofted_tube(
        "Smuff_Smile", smile_rings, segs=6, mat=mat_smile, cap_start=True, cap_end=True
    )
    assign_rigid_weight(smile, "Head")
    parts.append((smile, 0.0))

    # --- Draped White Phrygian Cap (matches references/characters_ref.png) ---
    cap_brim_rings = [
        {"pos": (0.0, 0.005, 0.885), "rx": 0.242, "ry": 0.228, "rot": (0.20, 0.0, 0.0)},
        {"pos": (0.0, 0.012, 0.925), "rx": 0.258, "ry": 0.244, "rot": (0.18, 0.0, 0.0)},
        {"pos": (0.0, 0.020, 0.962), "rx": 0.246, "ry": 0.232, "rot": (0.14, 0.0, 0.0)},
    ]
    cap_brim = create_lofted_tube(
        "Smuff_CapBrim", cap_brim_rings, segs=14, mat=mat_white, cap_start=True, cap_end=True
    )
    assign_rigid_weight(cap_brim, "Head")
    parts.append((cap_brim, 0.011))

    # Draped puffy Phrygian crown curving smoothly up and flopping forward-left (+X, -Y)
    cap_crown_rings = [
        {"pos": (0.0, 0.02, 0.95), "rx": 0.234, "ry": 0.220, "rot": (0.12, 0.0, 0.0)},
        {"pos": (-0.015, 0.035, 1.03), "rx": 0.230, "ry": 0.212, "rot": (0.02, -0.06, 0.0)},
        {"pos": (-0.010, 0.025, 1.115), "rx": 0.208, "ry": 0.192, "rot": (-0.15, -0.14, 0.0)},
        {"pos": (0.025, -0.010, 1.185), "rx": 0.178, "ry": 0.165, "rot": (-0.38, -0.28, 0.0)},
        {"pos": (0.085, -0.055, 1.215), "rx": 0.148, "ry": 0.138, "rot": (-0.65, -0.45, 0.0)},
        {"pos": (0.150, -0.095, 1.205), "rx": 0.125, "ry": 0.115, "rot": (-0.95, -0.62, 0.0)},
        {"pos": (0.195, -0.118, 1.165), "rx": 0.095, "ry": 0.088, "rot": (-1.18, -0.78, 0.0)},
        {"pos": (0.215, -0.128, 1.125), "rx": 0.052, "ry": 0.048, "rot": (-1.30, -0.85, 0.0)},
    ]
    cap_crown = create_lofted_tube(
        "Smuff_CapCrown", cap_crown_rings, segs=13, mat=mat_white, cap_start=True, cap_end=True
    )
    assign_gradient_weight(cap_crown, "Head", "Cap_Tip", (0.0, 0.02, 0.95), (0.17, -0.10, 1.19), blend_power=2.0)
    parts.append((cap_crown, 0.011))

    # --- Bare Blue Upper Torso ---
    torso_rings = [
        {"pos": (0, 0, 0.41), "rx": 0.192, "ry": 0.168},
        {"pos": (0, 0, 0.47), "rx": 0.196, "ry": 0.172},
        {"pos": (0, 0, 0.54), "rx": 0.186, "ry": 0.160},
        {"pos": (0, 0, 0.60), "rx": 0.148, "ry": 0.132},
        {"pos": (0, 0, 0.64), "rx": 0.108, "ry": 0.102},
    ]
    torso = create_lofted_tube(
        "Smuff_Torso", torso_rings, segs=12, mat=mat_blue, cap_start=True, cap_end=True
    )
    assign_gradient_weight(torso, "Hips", "Spine", (0, 0, 0.41), (0, 0, 0.52), blend_power=2.0)
    parts.append((torso, 0.011))

    # --- White Trousers Pelvis/Waist ---
    pelvis_rings = [
        {"pos": (0, 0, 0.23), "rx": 0.175, "ry": 0.155},
        {"pos": (0, 0, 0.30), "rx": 0.210, "ry": 0.185},
        {"pos": (0, 0, 0.38), "rx": 0.208, "ry": 0.182},
        {"pos": (0, 0, 0.43), "rx": 0.198, "ry": 0.174},
    ]
    pelvis = create_lofted_tube(
        "Smuff_Pelvis", pelvis_rings, segs=12, mat=mat_white, cap_start=True, cap_end=True
    )
    assign_rigid_weight(pelvis, "Hips")
    parts.append((pelvis, 0.011))

    # --- Cute Blue Pom-Pom Tail ---
    tail = create_uv_sphere(
        "Smuff_Tail",
        location=(0, 0.198, 0.285),
        scale=(0.052, 0.052, 0.052),
        segs=8,
        rings=5,
        mat=mat_blue,
    )
    assign_rigid_weight(tail, "Hips")
    parts.append((tail, 0.007))

    # --- Arms & Chunky Cartoon Hands ---
    for side, sx in (("L", 1), ("R", -1)):
        p_sh = (sx * 0.195, 0.0, 0.555)
        p_el = (sx * 0.285, -0.012, 0.430)
        p_wr = (sx * 0.340, -0.045, 0.295)

        uarm = create_capsule(
            f"Smuff_UpperArm_{side}", p_sh, p_el, 0.062, 0.054, segs=8, mid_rings=2, cap_rings=2, mat=mat_blue
        )
        assign_gradient_weight(uarm, "Spine", f"Arm_{side}", (sx * 0.17, 0, 0.56), (sx * 0.23, 0, 0.51))
        parts.append((uarm, 0.009))

        farm = create_capsule(
            f"Smuff_Forearm_{side}", p_el, p_wr, 0.054, 0.048, segs=8, mid_rings=2, cap_rings=2, mat=mat_blue
        )
        assign_gradient_weight(farm, f"Arm_{side}", f"Forearm_{side}", p_el, (sx * 0.305, -0.025, 0.39))
        parts.append((farm, 0.009))

        # Palm + fingers mitt + thumb
        palm = create_uv_sphere(
            f"Smuff_Hand_{side}",
            location=(sx * 0.352, -0.052, 0.262),
            scale=(0.052, 0.046, 0.058),
            rot=(0.15, sx * 0.22, 0.0),
            segs=8,
            rings=6,
            mat=mat_blue,
        )
        assign_rigid_weight(palm, f"Forearm_{side}")
        parts.append((palm, 0.008))

        thumb = create_capsule(
            f"Smuff_Thumb_{side}",
            (sx * 0.312, -0.065, 0.270),
            (sx * 0.282, -0.082, 0.232),
            0.024,
            0.020,
            segs=6,
            mid_rings=1,
            cap_rings=1,
            mat=mat_blue,
        )
        assign_rigid_weight(thumb, f"Forearm_{side}")
        parts.append((thumb, 0.006))

    # --- White Trouser Legs & Rounded White Boots ---
    for side, sx in (("L", 1), ("R", -1)):
        leg = create_capsule(
            f"Smuff_Leg_{side}",
            (sx * 0.122, 0.0, 0.275),
            (sx * 0.126, -0.005, 0.115),
            0.082,
            0.072,
            segs=9,
            mid_rings=2,
            cap_rings=2,
            mat=mat_white,
        )
        assign_gradient_weight(leg, "Hips", f"Leg_{side}", (sx * 0.122, 0, 0.29), (sx * 0.124, 0, 0.22))
        parts.append((leg, 0.010))

        # Rounded bulbous white boot resting cleanly at Z=0
        boot_rings = [
            {"pos": (sx * 0.130, 0.055, 0.062), "rx": 0.074, "ry": 0.058, "rot": (math.pi * 0.5, 0, 0)},
            {"pos": (sx * 0.132, -0.015, 0.064), "rx": 0.088, "ry": 0.064, "rot": (math.pi * 0.5, 0, 0)},
            {"pos": (sx * 0.136, -0.095, 0.060), "rx": 0.094, "ry": 0.060, "rot": (math.pi * 0.5, 0, 0)},
            {"pos": (sx * 0.138, -0.155, 0.052), "rx": 0.068, "ry": 0.048, "rot": (math.pi * 0.5, 0, 0)},
            {"pos": (sx * 0.138, -0.182, 0.045), "rx": 0.025, "ry": 0.020, "rot": (math.pi * 0.5, 0, 0)},
        ]
        boot = create_lofted_tube(
            f"Smuff_Boot_{side}", boot_rings, segs=10, mat=mat_white, cap_start=True, cap_end=True
        )
        # Flatten bottom slightly to Z=0.008 so outline sits on Z=0
        for v in boot.data.vertices:
            if v.co.z < 0.010:
                v.co.z = 0.010
        assign_rigid_weight(boot, f"Foot_{side}")
        parts.append((boot, 0.010))

    # Apply inverted-hull outlines & join into single skinned mesh
    smuff_mesh = apply_outlines_and_join(parts, mat_outline, "Smuff_Mesh", arm)

    # --- Animations (pushed to NLA tracks) ---
    # 1. Captured_Idle (looping, 1..60): hunched nervously in cage, looking left & right
    def anim_captured_idle(a):
        for f, bob, h_yaw, h_pit, sh_z in [
            (1, -0.015, 0.0, 4.0, 0.0),
            (15, -0.030, -22.0, 6.0, 3.0),
            (30, -0.015, 0.0, 2.0, 0.0),
            (45, -0.030, 22.0, 6.0, 3.0),
            (60, -0.015, 0.0, 4.0, 0.0),
        ]:
            kf_bone(a, "Hips", f, rot_deg=(4, 0, 0), loc=(0, 0, bob))
            kf_bone(a, "Spine", f, rot_deg=(5 + sh_z * 0.4, 0, 0))
            kf_bone(a, "Head", f, rot_deg=(h_pit, 0, h_yaw))
            kf_bone(a, "Cap_Tip", f, rot_deg=(3 + sh_z, 0, -h_yaw * 0.25))
            # Keep arms relaxed/tucked nervously in front, not splayed out
            kf_bone(a, "Arm_L", f, rot_deg=(14, 0, 16))
            kf_bone(a, "Forearm_L", f, rot_deg=(24, 0, 18))
            kf_bone(a, "Arm_R", f, rot_deg=(14, 0, -16))
            kf_bone(a, "Forearm_R", f, rot_deg=(24, 0, -18))
            kf_bone(a, "Leg_L", f, rot_deg=(-4, 0, 0))
            kf_bone(a, "Leg_R", f, rot_deg=(-4, 0, 0))

    push_action_to_nla(arm, "Captured_Idle", anim_captured_idle, 1, 60)

    # 2. Sneak_Walk (looping, 1..32): crouched stealth tiptoe walk
    def anim_sneak_walk(a):
        keys = [
            # frame, hip_z, hip_yaw, l_leg, r_leg, l_arm, r_arm
            (1, -0.06, -8, 32, -22, -22, 25),
            (9, -0.02, 0, 4, 8, 0, 0),
            (17, -0.06, 8, -22, 32, 25, -22),
            (25, -0.02, 0, 8, 4, 0, 0),
            (32, -0.06, -8, 32, -22, -22, 25),
        ]
        for f, hz, hy, ll, rl, la, ra in keys:
            kf_bone(a, "Hips", f, rot_deg=(16, 0, hy), loc=(0, 0, hz))
            kf_bone(a, "Spine", f, rot_deg=(14, 0, -hy * 0.7))
            kf_bone(a, "Head", f, rot_deg=(-18, 0, -hy * 0.4))
            kf_bone(a, "Cap_Tip", f, rot_deg=(10 + hz * 80, 0, 0))
            kf_bone(a, "Leg_L", f, rot_deg=(ll, 0, 0))
            kf_bone(a, "Foot_L", f, rot_deg=(-ll * 0.4, 0, 0))
            kf_bone(a, "Leg_R", f, rot_deg=(rl, 0, 0))
            kf_bone(a, "Foot_R", f, rot_deg=(-rl * 0.4, 0, 0))
            kf_bone(a, "Arm_L", f, rot_deg=(la + 12, 18, 12))
            kf_bone(a, "Forearm_L", f, rot_deg=(24, 0, 0))
            kf_bone(a, "Arm_R", f, rot_deg=(ra + 12, -18, -12))
            kf_bone(a, "Forearm_R", f, rot_deg=(24, 0, 0))

    push_action_to_nla(arm, "Sneak_Walk", anim_sneak_walk, 1, 32)

    # 3. Follow (looping, 1..24): cheerful bouncy trot following Boots
    def anim_follow(a):
        keys = [
            (1, 0.0, -10, 38, -34, -34, 38),
            (7, 0.055, 0, 6, -6, 0, 0),
            (13, 0.0, 10, -34, 38, 38, -34),
            (19, 0.055, 0, -6, 6, 0, 0),
            (24, 0.0, -10, 38, -34, -34, 38),
        ]
        for f, hz, hy, ll, rl, la, ra in keys:
            kf_bone(a, "Hips", f, rot_deg=(10, 0, hy), loc=(0, 0, hz))
            kf_bone(a, "Spine", f, rot_deg=(6, 0, -hy * 0.6))
            kf_bone(a, "Head", f, rot_deg=(-6, 0, 0))
            kf_bone(a, "Cap_Tip", f, rot_deg=(-hz * 220, 0, hy * 0.5))
            kf_bone(a, "Leg_L", f, rot_deg=(ll, 0, 0))
            kf_bone(a, "Foot_L", f, rot_deg=(-ll * 0.3, 0, 0))
            kf_bone(a, "Leg_R", f, rot_deg=(rl, 0, 0))
            kf_bone(a, "Foot_R", f, rot_deg=(-rl * 0.3, 0, 0))
            kf_bone(a, "Arm_L", f, rot_deg=(la, 8, 6))
            kf_bone(a, "Forearm_L", f, rot_deg=(30, 0, 0))
            kf_bone(a, "Arm_R", f, rot_deg=(ra, -8, -6))
            kf_bone(a, "Forearm_R", f, rot_deg=(30, 0, 0))

    push_action_to_nla(arm, "Follow", anim_follow, 1, 24)

    # 4. Ability_Cast (1..36): crafting speed-boost hop + magical double-arm flourish
    def anim_ability_cast(a):
        poses = [
            # frame, hip_z, spine_x, head_x, arm_x, arm_z, farm_x, cap_x
            (1, 0.0, 0, 0, 0, 0, 0, 0),
            (8, -0.06, 18, 8, -25, 10, 35, 10),
            (16, 0.14, -14, -18, 125, -22, 18, -22),
            (24, 0.05, 16, 6, 75, 15, -10, 18),
            (36, 0.0, 0, 0, 0, 0, 0, 0),
        ]
        for f, hz, sx, hx, ax, az, fx, cx in poses:
            kf_bone(a, "Hips", f, rot_deg=(0, 0, 0), loc=(0, 0, hz))
            kf_bone(a, "Spine", f, rot_deg=(sx, 0, 0))
            kf_bone(a, "Head", f, rot_deg=(hx, 0, 0))
            kf_bone(a, "Cap_Tip", f, rot_deg=(cx, 0, 0))
            kf_bone(a, "Arm_L", f, rot_deg=(ax, 0, az))
            kf_bone(a, "Forearm_L", f, rot_deg=(fx, 0, 0))
            kf_bone(a, "Arm_R", f, rot_deg=(ax, 0, -az))
            kf_bone(a, "Forearm_R", f, rot_deg=(fx, 0, 0))
            kf_bone(a, "Leg_L", f, rot_deg=(-hz * 90, 0, 0))
            kf_bone(a, "Leg_R", f, rot_deg=(-hz * 90, 0, 0))

    push_action_to_nla(arm, "Ability_Cast", anim_ability_cast, 1, 36)

    export_glb(SMUFF_GLB, [arm, smuff_mesh])
    return inspect_glb(SMUFF_GLB)


# ===========================================================================
# 2. FBI AGENT (public/models/fbi_agent.glb, ~5,000 tris)
# ===========================================================================
def add_fbi_letters(parts, center, scale_xyz, rot_xyz, mat_gold, bone_name):
    """Build crisp low-poly 3D extruded 'FBI' lettering without external textures."""
    cx, cy, cz = center
    sx, sy, sz = scale_xyz
    rot_m = Euler(rot_xyz, "XYZ").to_matrix()

    # Local stroke segments (x, z, w, h) for F, B, I centered around x=0
    # Note: facing -Y, so reading left-to-right from viewer means -X to +X!
    strokes = [
        # 'F' on viewer's left (-X)
        (-0.85, 0.0, 0.16, 1.0),
        (-0.62, 0.42, 0.46, 0.16),
        (-0.66, 0.04, 0.38, 0.15),
        # 'B' in center
        (-0.22, 0.0, 0.16, 1.0),
        (0.02, 0.42, 0.42, 0.15),
        (0.02, 0.02, 0.42, 0.15),
        (0.02, -0.42, 0.42, 0.15),
        (0.20, 0.22, 0.15, 0.36),
        (0.22, -0.20, 0.15, 0.38),
        # 'I' on viewer's right (+X)
        (0.66, 0.0, 0.16, 1.0),
        (0.66, 0.42, 0.42, 0.15),
        (0.66, -0.42, 0.42, 0.15),
    ]
    for idx, (lx, lz, lw, lh) in enumerate(strokes):
        local_pos = Vector((lx * sx, 0.0, lz * sz))
        world_pos = Vector((cx, cy, cz)) + (rot_m @ local_pos)
        bar = create_box(
            f"FBI_Letter_{idx}",
            location=world_pos,
            size=(lw * sx, sy, lh * sz),
            rot=rot_xyz,
            bevel=0.0,
            mat=mat_gold,
            smooth=False,
        )
        assign_rigid_weight(bar, bone_name)
        parts.append((bar, 0.0))


def build_fbi_agent():
    reset_scene()

    # Materials matching tactical FBI style + stylized Survivalists proportions
    mat_suit = make_toon_mat("FBI_Tactical_Suit", "#1B1E26", roughness=0.84, specular=0.18)
    mat_vest = make_toon_mat("FBI_Vest_Charcoal", "#272C37", roughness=0.80, specular=0.20)
    mat_cap = make_toon_mat("FBI_Cap_Black", "#171920", roughness=0.85, specular=0.16)
    mat_boot = make_toon_mat("FBI_Boot_Leather", "#14161B", roughness=0.58, specular=0.35)
    mat_skin = make_toon_mat("FBI_Skin", "#E4AF8A", roughness=0.78, specular=0.18)
    mat_shades = make_toon_mat("FBI_Sunglasses", "#0A0C12", roughness=0.12, metallic=0.25, specular=0.85)
    mat_gold = make_toon_mat("FBI_Gold_Badge", "#F4C430", roughness=0.28, metallic=0.82, specular=0.65)
    mat_earpiece = make_toon_mat("FBI_Earpiece", "#6F7885", roughness=0.45, metallic=0.30, specular=0.40)
    mat_gun = make_toon_mat("FBI_Rifle_Metal", "#323844", roughness=0.42, metallic=0.55, specular=0.50)
    mat_gun_dark = make_toon_mat("FBI_Rifle_Polymer", "#1C2028", roughness=0.72, specular=0.25)
    mat_dart_glow = make_toon_mat(
        "FBI_Tranq_Cyan",
        "#18E0D8",
        roughness=0.25,
        emission_hex="#18E0D8",
        emission_strength=1.8,
    )
    mat_orange = make_toon_mat("FBI_Tranq_Orange", "#F26A1B", roughness=0.55, specular=0.30)
    mat_light_lens = make_toon_mat(
        "FBI_Flashlight_Lens",
        "#FFF6C2",
        roughness=0.15,
        emission_hex="#FFE88A",
        emission_strength=2.2,
    )
    mat_outline = make_outline_mat()

    # Armature (~1.58m stylized tactical humanoid, faces -Y, feet on Z=0)
    bone_defs = [
        ("Root", (0, 0, 0.0), (0, 0, 0.72), None, False),
        ("Hips", (0, 0, 0.72), (0, 0, 0.86), "Root", False),
        ("Spine", (0, 0, 0.86), (0, 0, 1.18), "Hips", True),
        ("Head", (0, 0, 1.18), (0, 0, 1.56), "Spine", True),
        # Left Arm (+X, holds tactical flashlight)
        ("Arm_L", (0.255, 0.0, 1.11), (0.295, -0.05, 0.90), "Spine", False),
        ("Forearm_L", (0.295, -0.05, 0.90), (0.265, -0.24, 0.86), "Arm_L", True),
        ("Hand_L", (0.265, -0.24, 0.86), (0.265, -0.36, 0.86), "Forearm_L", True),
        # Right Arm (-X, holds tranquilizer rifle)
        ("Arm_R", (-0.255, 0.0, 1.11), (-0.295, -0.05, 0.90), "Spine", False),
        ("Forearm_R", (-0.295, -0.05, 0.90), (-0.265, -0.24, 0.86), "Arm_R", True),
        ("Hand_R", (-0.265, -0.24, 0.86), (-0.265, -0.36, 0.86), "Forearm_R", True),
        # Legs
        ("Thigh_L", (0.125, 0.0, 0.72), (0.125, 0.0, 0.42), "Hips", False),
        ("Shin_L", (0.125, 0.0, 0.42), (0.125, 0.0, 0.13), "Thigh_L", True),
        ("Foot_L", (0.125, 0.0, 0.13), (0.125, -0.14, 0.05), "Shin_L", True),
        ("Thigh_R", (-0.125, 0.0, 0.72), (-0.125, 0.0, 0.42), "Hips", False),
        ("Shin_R", (-0.125, 0.0, 0.42), (-0.125, 0.0, 0.13), "Thigh_R", True),
        ("Foot_R", (-0.125, 0.0, 0.13), (-0.125, -0.14, 0.05), "Shin_R", True),
    ]
    arm = create_armature("FBIAgent_Armature", bone_defs)

    parts = []

    # --- Stylized Humanoid Head ---
    head = create_uv_sphere(
        "FBI_Head",
        location=(0, -0.005, 1.355),
        scale=(0.172, 0.178, 0.192),
        segs=12,
        rings=9,
        mat=mat_skin,
    )
    assign_rigid_weight(head, "Head")
    parts.append((head, 0.011))

    # Nose
    nose = create_box(
        "FBI_Nose",
        location=(0, -0.184, 1.335),
        size=(0.032, 0.034, 0.044),
        bevel=0.009,
        bevel_segs=1,
        mat=mat_skin,
        smooth=True,
    )
    assign_rigid_weight(nose, "Head")
    parts.append((nose, 0.0))

    # Ears
    for side, sx in (("L", 1), ("R", -1)):
        ear = create_uv_sphere(
            f"FBI_Ear_{side}",
            location=(sx * 0.174, 0.010, 1.350),
            scale=(0.030, 0.025, 0.046),
            segs=8,
            rings=6,
            mat=mat_skin,
        )
        assign_rigid_weight(ear, "Head")
        parts.append((ear, 0.006))

    # Stern mouth line
    mouth = create_box(
        "FBI_Mouth",
        location=(0, -0.166, 1.258),
        size=(0.068, 0.012, 0.010),
        mat=mat_suit,
        smooth=False,
    )
    assign_rigid_weight(mouth, "Head")
    parts.append((mouth, 0.0))

    # --- Dark Tactical Sunglasses ---
    for side, sx in (("L", 1), ("R", -1)):
        lens = create_box(
            f"FBI_Lens_{side}",
            location=(sx * 0.064, -0.175, 1.380),
            size=(0.088, 0.024, 0.056),
            rot=(0.0, 0.0, sx * -0.14),
            bevel=0.008,
            bevel_segs=1,
            mat=mat_shades,
            smooth=False,
        )
        assign_rigid_weight(lens, "Head")
        parts.append((lens, 0.0))

        temple = create_box(
            f"FBI_Temple_{side}",
            location=(sx * 0.165, -0.075, 1.385),
            size=(0.014, 0.190, 0.016),
            rot=(0.0, 0.0, sx * 0.08),
            mat=mat_shades,
            smooth=False,
        )
        assign_rigid_weight(temple, "Head")
        parts.append((temple, 0.0))

    bridge = create_box(
        "FBI_Shades_Bridge",
        location=(0, -0.184, 1.390),
        size=(0.050, 0.018, 0.016),
        mat=mat_shades,
        smooth=False,
    )
    assign_rigid_weight(bridge, "Head")
    parts.append((bridge, 0.0))

    # --- Tactical Earpiece + Coiled Wire (Right ear -> collar) ---
    earbud = create_box(
        "FBI_Earpiece_Bud",
        location=(-0.190, 0.008, 1.345),
        size=(0.022, 0.026, 0.036),
        bevel=0.005,
        mat=mat_earpiece,
        smooth=True,
    )
    assign_rigid_weight(earbud, "Head")
    parts.append((earbud, 0.0))

    cord_rings = [
        {"pos": (-0.188, 0.015, 1.330), "rx": 0.008, "ry": 0.008},
        {"pos": (-0.172, 0.045, 1.280), "rx": 0.010, "ry": 0.010},
        {"pos": (-0.155, 0.050, 1.235), "rx": 0.010, "ry": 0.010},
        {"pos": (-0.135, 0.035, 1.195), "rx": 0.008, "ry": 0.008},
    ]
    cord = create_lofted_tube("FBI_Earpiece_Cord", cord_rings, segs=6, mat=mat_earpiece)
    assign_gradient_weight(cord, "Spine", "Head", (-0.135, 0.035, 1.195), (-0.188, 0.015, 1.330))
    parts.append((cord, 0.0))

    # --- Black FBI Baseball Cap ---
    cap_rings = [
        {"pos": (0, 0.008, 1.445), "rx": 0.185, "ry": 0.194, "rot": (0.04, 0, 0)},
        {"pos": (0, 0.008, 1.505), "rx": 0.184, "ry": 0.192, "rot": (0.02, 0, 0)},
        {"pos": (0, 0.010, 1.568), "rx": 0.152, "ry": 0.160, "rot": (0.01, 0, 0)},
        {"pos": (0, 0.012, 1.608), "rx": 0.088, "ry": 0.095, "rot": (0.0, 0, 0)},
        {"pos": (0, 0.012, 1.622), "rx": 0.020, "ry": 0.020, "rot": (0.0, 0, 0)},
    ]
    cap_crown = create_lofted_tube("FBI_Cap_Crown", cap_rings, segs=14, mat=mat_cap)
    assign_rigid_weight(cap_crown, "Head")
    parts.append((cap_crown, 0.010))

    # Cap Visor / Brim pointing forward (-Y), angled subtly so sunglasses show cleanly
    visor_rings = [
        {"pos": (0, -0.155, 1.452), "rx": 0.165, "ry": 0.016, "rot": (math.pi * 0.5 + 0.08, 0, 0)},
        {"pos": (0, -0.230, 1.444), "rx": 0.152, "ry": 0.015, "rot": (math.pi * 0.5 + 0.10, 0, 0)},
        {"pos": (0, -0.292, 1.436), "rx": 0.115, "ry": 0.012, "rot": (math.pi * 0.5 + 0.12, 0, 0)},
        {"pos": (0, -0.320, 1.430), "rx": 0.062, "ry": 0.010, "rot": (math.pi * 0.5 + 0.14, 0, 0)},
    ]
    cap_visor = create_lofted_tube("FBI_Cap_Visor", visor_rings, segs=10, mat=mat_cap)
    assign_rigid_weight(cap_visor, "Head")
    parts.append((cap_visor, 0.008))

    # Crisp Gold "FBI" lettering on front of cap
    add_fbi_letters(
        parts,
        center=(0.0, -0.194, 1.518),
        scale_xyz=(0.082, 0.014, 0.056),
        rot_xyz=(-0.10, 0.0, 0.0),
        mat_gold=mat_gold,
        bone_name="Head",
    )

    # --- Black Tactical Windbreaker / Suit Torso ---
    torso_rings = [
        {"pos": (0, 0, 0.72), "rx": 0.195, "ry": 0.132},
        {"pos": (0, 0, 0.84), "rx": 0.190, "ry": 0.130},
        {"pos": (0, 0, 0.98), "rx": 0.220, "ry": 0.148},
        {"pos": (0, 0, 1.13), "rx": 0.242, "ry": 0.152},
        {"pos": (0, 0, 1.19), "rx": 0.155, "ry": 0.118},
    ]
    torso = create_lofted_tube("FBI_Torso", torso_rings, segs=14, mat=mat_suit)
    assign_gradient_weight(torso, "Hips", "Spine", (0, 0, 0.72), (0, 0, 0.90), blend_power=2.0)
    parts.append((torso, 0.012))

    # Tactical Vest Overlay + Standing Windbreaker Collar
    vest = create_box(
        "FBI_Tactical_Vest",
        location=(0, -0.005, 0.985),
        size=(0.39, 0.305, 0.30),
        bevel=0.032,
        bevel_segs=1,
        mat=mat_vest,
        smooth=True,
    )
    assign_rigid_weight(vest, "Spine")
    parts.append((vest, 0.008))

    collar = create_cylinder(
        "FBI_Collar", (0, 0, 1.16), (0, 0, 1.235), 0.128, 0.122, segs=12, mat=mat_suit
    )
    assign_rigid_weight(collar, "Spine")
    parts.append((collar, 0.008))

    # Gold FBI Chest Badge (viewer's right / agent's left chest)
    badge = create_box(
        "FBI_Gold_Badge",
        location=(0.105, -0.160, 1.055),
        size=(0.056, 0.016, 0.068),
        bevel=0.008,
        mat=mat_gold,
        smooth=False,
    )
    assign_rigid_weight(badge, "Spine")
    parts.append((badge, 0.0))

    # Gold "FBI" lettering on back of tactical windbreaker (visible from isometric!)
    add_fbi_letters(
        parts,
        center=(0.0, 0.158, 1.035),
        scale_xyz=(0.135, 0.014, 0.088),
        rot_xyz=(0.0, 0.0, math.pi),
        mat_gold=mat_gold,
        bone_name="Spine",
    )

    # Tactical Utility Belt + Buckle + Hip Pouches
    belt = create_cylinder(
        "FBI_Belt", (0, 0, 0.755), (0, 0, 0.815), 0.208, 0.208, segs=14, mat=mat_boot, smooth=False
    )
    for v in belt.data.vertices:
        v.co.y *= 0.72
    assign_rigid_weight(belt, "Hips")
    parts.append((belt, 0.008))

    buckle = create_box(
        "FBI_Buckle",
        location=(0, -0.154, 0.785),
        size=(0.064, 0.022, 0.054),
        bevel=0.004,
        mat=mat_gold,
        smooth=False,
    )
    assign_rigid_weight(buckle, "Hips")
    parts.append((buckle, 0.0))

    for side, sx in (("L", 1), ("R", -1)):
        pouch = create_box(
            f"FBI_Pouch_{side}",
            location=(sx * 0.212, -0.02, 0.775),
            size=(0.048, 0.082, 0.088),
            bevel=0.008,
            mat=mat_vest,
            smooth=False,
        )
        assign_rigid_weight(pouch, "Hips")
        parts.append((pouch, 0.006))

    # --- Arms & Gloved Hands ---
    for side, sx in (("L", 1), ("R", -1)):
        p_sh = (sx * 0.252, 0.0, 1.105)
        p_el = (sx * 0.295, -0.050, 0.900)
        p_wr = (sx * 0.265, -0.235, 0.860)

        uarm = create_capsule(
            f"FBI_UpperArm_{side}", p_sh, p_el, 0.072, 0.062, segs=9, mid_rings=2, cap_rings=2, mat=mat_suit
        )
        assign_gradient_weight(uarm, "Spine", f"Arm_{side}", (sx * 0.22, 0, 1.11), (sx * 0.27, -0.02, 1.03))
        parts.append((uarm, 0.010))

        farm = create_capsule(
            f"FBI_Forearm_{side}", p_el, p_wr, 0.060, 0.052, segs=9, mid_rings=2, cap_rings=2, mat=mat_suit
        )
        assign_gradient_weight(farm, f"Arm_{side}", f"Forearm_{side}", p_el, (sx * 0.28, -0.12, 0.88))
        parts.append((farm, 0.009))

        glove = create_uv_sphere(
            f"FBI_Hand_{side}",
            location=(sx * 0.265, -0.255, 0.858),
            scale=(0.050, 0.058, 0.046),
            segs=8,
            rings=6,
            mat=mat_boot,
        )
        assign_rigid_weight(glove, f"Hand_{side}")
        parts.append((glove, 0.007))

    # --- Tactical Cargo Legs & Combat Boots ---
    for side, sx in (("L", 1), ("R", -1)):
        thigh = create_capsule(
            f"FBI_Thigh_{side}",
            (sx * 0.125, 0.0, 0.72),
            (sx * 0.125, 0.0, 0.42),
            0.094,
            0.078,
            segs=9,
            mid_rings=2,
            cap_rings=2,
            mat=mat_suit,
        )
        assign_gradient_weight(thigh, "Hips", f"Thigh_{side}", (sx * 0.125, 0, 0.73), (sx * 0.125, 0, 0.62))
        parts.append((thigh, 0.010))

        shin = create_capsule(
            f"FBI_Shin_{side}",
            (sx * 0.125, 0.0, 0.42),
            (sx * 0.125, 0.0, 0.14),
            0.078,
            0.064,
            segs=9,
            mid_rings=2,
            cap_rings=2,
            mat=mat_suit,
        )
        assign_gradient_weight(shin, f"Thigh_{side}", f"Shin_{side}", (sx * 0.125, 0, 0.43), (sx * 0.125, 0, 0.36))
        parts.append((shin, 0.010))

        boot_upper = create_box(
            f"FBI_Boot_{side}",
            location=(sx * 0.125, -0.052, 0.078),
            size=(0.132, 0.235, 0.132),
            bevel=0.022,
            bevel_segs=1,
            mat=mat_boot,
            smooth=True,
        )
        assign_rigid_weight(boot_upper, f"Foot_{side}")
        parts.append((boot_upper, 0.010))

    # --- Mid-Poly Tranquilizer Rifle (attached to Hand_R) ---
    rx, ry, rz = -0.265, -0.265, 0.895
    rifle_parts = [
        # Receiver body
        (create_box("Tranq_Receiver", (rx, ry - 0.08, rz), (0.062, 0.30, 0.082), bevel=0.008, mat=mat_gun_dark), 0.007),
        # Shoulder stock
        (create_box("Tranq_Stock", (rx, ry + 0.14, rz - 0.015), (0.048, 0.18, 0.095), bevel=0.008, mat=mat_gun_dark), 0.007),
        # Pistol grip inside right hand
        (create_box("Tranq_Grip", (rx, ry + 0.01, rz - 0.065), (0.040, 0.052, 0.095), rot=(0.25, 0, 0), bevel=0.006, mat=mat_gun_dark), 0.0),
        # Magazine
        (create_box("Tranq_Mag", (rx, ry - 0.12, rz - 0.075), (0.036, 0.062, 0.115), rot=(-0.18, 0, 0), bevel=0.005, mat=mat_gun), 0.005),
        # Barrel
        (create_cylinder("Tranq_Barrel", (rx, ry - 0.22, rz + 0.012), (rx, ry - 0.56, rz + 0.012), 0.024, 0.020, segs=10, mat=mat_gun), 0.006),
        # Orange tranquilizer muzzle collar
        (create_cylinder("Tranq_Muzzle", (rx, ry - 0.53, rz + 0.012), (rx, ry - 0.60, rz + 0.012), 0.028, 0.030, segs=10, mat=mat_orange), 0.005),
        # Glowing cyan tranquilizer dart cartridge on upper side (clearly visible from 45° isometric)
        (create_cylinder("Tranq_DartTube", (rx - 0.022, ry - 0.24, rz + 0.032), (rx - 0.022, ry - 0.45, rz + 0.032), 0.018, 0.018, segs=8, mat=mat_dart_glow), 0.0),
        # Tactical Scope
        (create_cylinder("Tranq_Scope", (rx, ry - 0.01, rz + 0.078), (rx, ry - 0.22, rz + 0.078), 0.024, 0.028, segs=10, mat=mat_gun), 0.005),
        (create_box("Tranq_ScopeMount", (rx, ry - 0.11, rz + 0.052), (0.026, 0.11, 0.028), mat=mat_gun_dark), 0.0),
    ]
    for obj, th in rifle_parts:
        assign_rigid_weight(obj, "Hand_R")
        parts.append((obj, th))

    # --- Tactical Flashlight (attached to Hand_L) ---
    fx, fy, fz = 0.265, -0.255, 0.865
    fl_body = create_cylinder("Flashlight_Body", (fx, fy + 0.07, fz), (fx, fy - 0.11, fz), 0.026, 0.026, segs=10, mat=mat_gun_dark)
    assign_rigid_weight(fl_body, "Hand_L")
    parts.append((fl_body, 0.006))

    fl_head = create_cylinder("Flashlight_Head", (fx, fy - 0.10, fz), (fx, fy - 0.18, fz), 0.028, 0.044, segs=10, mat=mat_gun)
    assign_rigid_weight(fl_head, "Hand_L")
    parts.append((fl_head, 0.006))

    fl_lens = create_cylinder("Flashlight_Lens", (fx, fy - 0.175, fz), (fx, fy - 0.186, fz), 0.038, 0.038, segs=10, mat=mat_light_lens)
    assign_rigid_weight(fl_lens, "Hand_L")
    parts.append((fl_lens, 0.0))

    # Apply inverted-hull outlines & join into single skinned mesh
    fbi_mesh = apply_outlines_and_join(parts, mat_outline, "FBIAgent_Mesh", arm)

    # --- Animations (pushed to NLA tracks) ---
    # 1. Patrol_Walk (looping, 1..32): steady tactical patrol stride
    def anim_patrol_walk(a):
        keys = [
            (1, 0.0, -5, 24, -18, -20, 10),
            (9, 0.035, 0, 0, -28, 0, -4),
            (17, 0.0, 5, -20, 10, 24, -18),
            (25, 0.035, 0, 0, -4, 0, -28),
            (32, 0.0, -5, 24, -18, -20, 10),
        ]
        for f, hz, hy, tl, sl, tr, sr in keys:
            kf_bone(a, "Hips", f, rot_deg=(3, 0, hy), loc=(0, 0, hz))
            kf_bone(a, "Spine", f, rot_deg=(4, 0, -hy * 0.6))
            kf_bone(a, "Head", f, rot_deg=(-2, 0, -hy * 0.4))
            kf_bone(a, "Thigh_L", f, rot_deg=(tl, 0, 0))
            kf_bone(a, "Shin_L", f, rot_deg=(sl, 0, 0))
            kf_bone(a, "Thigh_R", f, rot_deg=(tr, 0, 0))
            kf_bone(a, "Shin_R", f, rot_deg=(sr, 0, 0))
            # Left arm holds flashlight steadily forward-down with slight sway
            kf_bone(a, "Arm_L", f, rot_deg=(12 + hy * 0.8, 0, -4))
            kf_bone(a, "Forearm_L", f, rot_deg=(8, 0, 0))
            # Right arm holds tranquilizer rifle at low-ready
            kf_bone(a, "Arm_R", f, rot_deg=(8 - hy * 0.5, 0, 8))
            kf_bone(a, "Forearm_R", f, rot_deg=(10, 0, 12))

    push_action_to_nla(arm, "Patrol_Walk", anim_patrol_walk, 1, 32)

    # 2. Flashlight_Sweep (looping, 1..60): sweeping tactical flashlight left-to-right
    def anim_flashlight_sweep(a):
        keys = [
            (1, 0, 0, 0),
            (15, -24, -22, -32),
            (30, 0, 0, 0),
            (45, 24, 22, 32),
            (60, 0, 0, 0),
        ]
        for f, sp_z, hd_z, fl_z in keys:
            kf_bone(a, "Hips", f, rot_deg=(2, 0, sp_z * 0.25), loc=(0, 0, -0.02))
            kf_bone(a, "Spine", f, rot_deg=(5, 0, sp_z))
            kf_bone(a, "Head", f, rot_deg=(4, 0, hd_z))
            kf_bone(a, "Arm_L", f, rot_deg=(36, 0, fl_z * 0.7))
            kf_bone(a, "Forearm_L", f, rot_deg=(14, 0, fl_z * 0.5))
            kf_bone(a, "Hand_L", f, rot_deg=(0, 0, fl_z * 0.3))
            kf_bone(a, "Arm_R", f, rot_deg=(18, 0, 10))
            kf_bone(a, "Forearm_R", f, rot_deg=(18, 0, 14))
            kf_bone(a, "Thigh_L", f, rot_deg=(8, 0, 0))
            kf_bone(a, "Thigh_R", f, rot_deg=(-8, 0, 0))

    push_action_to_nla(arm, "Flashlight_Sweep", anim_flashlight_sweep, 1, 60)

    # 3. Alert_Spot (1..30): sudden startled spot -> snap rifle up to aim + shine flashlight
    def anim_alert_spot(a):
        poses = [
            # frame, hip_z, spine_x, head_x, armL_x, armR_x, farmR_x
            (1, 0.0, 4, 4, 12, 8, 10),
            (7, 0.06, -12, -14, 52, 42, 22),
            (16, -0.03, 10, -4, 48, 62, 18),
            (30, -0.02, 8, -2, 44, 56, 16),
        ]
        for f, hz, sx, hx, alx, arx, frx in poses:
            kf_bone(a, "Hips", f, rot_deg=(0, 0, -10 if f >= 16 else 0), loc=(0, 0, hz))
            kf_bone(a, "Spine", f, rot_deg=(sx, 0, -8 if f >= 16 else 0))
            kf_bone(a, "Head", f, rot_deg=(hx, 0, 12 if f >= 16 else 0))
            kf_bone(a, "Arm_L", f, rot_deg=(alx, 0, -8))
            kf_bone(a, "Forearm_L", f, rot_deg=(12, 0, 8))
            kf_bone(a, "Arm_R", f, rot_deg=(arx, 0, 10))
            kf_bone(a, "Forearm_R", f, rot_deg=(frx, 0, 16))
            kf_bone(a, "Thigh_L", f, rot_deg=(14 if f >= 16 else 0, 0, 0))
            kf_bone(a, "Thigh_R", f, rot_deg=(-14 if f >= 16 else 0, 0, 0))

    push_action_to_nla(arm, "Alert_Spot", anim_alert_spot, 1, 30)

    # 4. Chase (looping, 1..20): aggressive tactical sprint
    def anim_chase(a):
        keys = [
            (1, -0.04, -12, 44, -22, -36, -34, -25),
            (6, 0.045, 0, 6, -52, 8, -14, 12),
            (11, -0.04, 12, -36, -34, 44, -22, 34),
            (16, 0.045, 0, 8, -14, 6, -52, -8),
            (20, -0.04, -12, 44, -22, -36, -34, -25),
        ]
        for f, hz, hy, tl, sl, tr, sr, alx in keys:
            kf_bone(a, "Hips", f, rot_deg=(16, 0, hy), loc=(0, 0, hz))
            kf_bone(a, "Spine", f, rot_deg=(12, 0, -hy * 0.7))
            kf_bone(a, "Head", f, rot_deg=(-18, 0, -hy * 0.3))
            kf_bone(a, "Thigh_L", f, rot_deg=(tl, 0, 0))
            kf_bone(a, "Shin_L", f, rot_deg=(sl, 0, 0))
            kf_bone(a, "Thigh_R", f, rot_deg=(tr, 0, 0))
            kf_bone(a, "Shin_R", f, rot_deg=(sr, 0, 0))
            kf_bone(a, "Arm_L", f, rot_deg=(alx + 18, 0, -6))
            kf_bone(a, "Forearm_L", f, rot_deg=(28, 0, 0))
            kf_bone(a, "Arm_R", f, rot_deg=(28, 0, 18))
            kf_bone(a, "Forearm_R", f, rot_deg=(24, 0, 22))

    push_action_to_nla(arm, "Chase", anim_chase, 1, 20)

    # 5. Shoot_Tranq (1..30): braced aim -> sharp tranquilizer rifle recoil -> recover
    def anim_shoot_tranq(a):
        poses = [
            # frame, spine_x, armR_x, farmR_x, armL_x, head_x
            (1, 8, 52, 16, 40, -6),
            (10, 10, 62, 18, 48, -8),
            (14, -8, 80, 26, 54, -16),  # Recoil kickback!
            (21, 6, 58, 16, 44, -6),
            (30, 8, 52, 16, 40, -6),
        ]
        for f, sx, arx, frx, alx, hx in poses:
            kf_bone(a, "Hips", f, rot_deg=(4, 0, -18), loc=(0, 0, -0.04))
            kf_bone(a, "Spine", f, rot_deg=(sx, 0, -10))
            kf_bone(a, "Head", f, rot_deg=(hx, 0, 24))
            kf_bone(a, "Arm_R", f, rot_deg=(arx, 0, 14))
            kf_bone(a, "Forearm_R", f, rot_deg=(frx, 0, 20))
            kf_bone(a, "Hand_R", f, rot_deg=(-8 if f == 14 else 0, 0, 0))
            kf_bone(a, "Arm_L", f, rot_deg=(alx, 0, -24))
            kf_bone(a, "Forearm_L", f, rot_deg=(20, 0, -28))
            kf_bone(a, "Thigh_L", f, rot_deg=(20, 0, 0))
            kf_bone(a, "Shin_L", f, rot_deg=(-16, 0, 0))
            kf_bone(a, "Thigh_R", f, rot_deg=(-18, 0, 0))
            kf_bone(a, "Shin_R", f, rot_deg=(-12, 0, 0))

    push_action_to_nla(arm, "Shoot_Tranq", anim_shoot_tranq, 1, 30)

    export_glb(FBI_GLB, [arm, fbi_mesh])
    return inspect_glb(FBI_GLB)


def main():
    print("=== EXOTIC-004: Building Smuff & FBI Agent ===")
    smuff_stats = build_smuff()
    fbi_stats = build_fbi_agent()
    print("=== EXOTIC-004 Complete ===")
    print(f"  Smuff    : {smuff_stats[0]} tris, anims={smuff_stats[1]}")
    print(f"  FBI Agent: {fbi_stats[0]} tris, anims={fbi_stats[1]}")


if __name__ == "__main__":
    main()
