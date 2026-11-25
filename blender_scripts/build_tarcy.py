"""
EXOTIC-002: Protagonist Model & Rig — Tarcy (Boots)
Generates a stylized mid-poly 3D monkey matching references/characters_ref.png
with 2-step cel-friendly PBR materials, inverted-hull black outlines
(doubleSided: false), full humanoid + tail armature, and 8 NLA animations.

Run headless:
    blender --background --python blender_scripts/build_tarcy.py
Outputs:
    public/models/tarcy_boots.glb
"""

import math
import os
import bpy
import bmesh
from mathutils import Vector, Euler, Matrix


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def srgb_to_linear(c):
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def hex_to_rgba(hex_str, alpha=1.0):
    hex_str = hex_str.lstrip("#")
    r = srgb_to_linear(int(hex_str[0:2], 16) / 255.0)
    g = srgb_to_linear(int(hex_str[2:4], 16) / 255.0)
    b = srgb_to_linear(int(hex_str[4:6], 16) / 255.0)
    return (r, g, b, alpha)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_material(name, hex_color, roughness=0.75, specular=0.2, metallic=0.0,
                  coat_weight=0.0, backface_culling=False, is_outline=False):
    mat = bpy.data.materials.new(name=name)
    if mat.node_tree is None:
        mat.use_nodes = True
    mat.use_backface_culling = backface_culling
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    if is_outline:
        bsdf.inputs["Base Color"].default_value = (0.003, 0.003, 0.005, 1.0)
        bsdf.inputs["Roughness"].default_value = 1.0
        bsdf.inputs["Metallic"].default_value = 0.0
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = 0.0
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (0.0, 0.0, 0.0, 1.0)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = 0.0
    else:
        bsdf.inputs["Base Color"].default_value = hex_to_rgba(hex_color)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = specular
        if coat_weight > 0.0 and "Coat Weight" in bsdf.inputs:
            bsdf.inputs["Coat Weight"].default_value = coat_weight
            if "Coat Roughness" in bsdf.inputs:
                bsdf.inputs["Coat Roughness"].default_value = 0.12
    return mat


def create_materials():
    """Create the glTF-compatible stylized cel/PBR palette matching characters_ref.png."""
    mats = {
        "body": make_material("Mat_BodyLavender", "#A8A2C2", roughness=0.78, specular=0.16),
        "pink": make_material("Mat_Pink", "#F9C2D6", roughness=0.74, specular=0.16),
        "yellow": make_material("Mat_BellyYellow", "#FCE84F", roughness=0.70, specular=0.15),
        "tuft_white": make_material("Mat_TuftWhite", "#FFFFFF", roughness=0.72, specular=0.15),
        "boot_red": make_material("Mat_BootRed", "#E02028", roughness=0.18, specular=0.65, coat_weight=0.45),
        "boot_sole": make_material("Mat_BootSole", "#8E1218", roughness=0.42, specular=0.35),
        "eye_white": make_material("Mat_EyeWhite", "#FFFFFF", roughness=0.35, specular=0.25),
        "dark": make_material("Mat_DarkFeature", "#2A1822", roughness=0.42, specular=0.22),
        "outline": make_material("Mat_Outline", "#0A090E", roughness=1.0, specular=0.0,
                                 backface_culling=True, is_outline=True),
    }
    return mats


def set_smooth(obj):
    mesh = obj.data
    mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))
    mesh.update()


def assign_mat(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.material_index = 0


def assign_uniform_weight(obj, bone_name, weight=1.0):
    vg = obj.vertex_groups.get(bone_name) or obj.vertex_groups.new(name=bone_name)
    vg.add([v.index for v in obj.data.vertices], weight, 'REPLACE')


def assign_gradient_weights(obj, bone_a, bone_b, axis_fn, v_min, v_max):
    """Smoothly blend vertex weights between bone_a (at <= v_min) and bone_b (at >= v_max)."""
    vg_a = obj.vertex_groups.get(bone_a) or obj.vertex_groups.new(name=bone_a)
    vg_b = obj.vertex_groups.get(bone_b) or obj.vertex_groups.new(name=bone_b)
    span = max(v_max - v_min, 1e-5)
    for v in obj.data.vertices:
        val = axis_fn(v.co)
        t = max(0.0, min(1.0, (val - v_min) / span))
        # Smoothstep for organic joint bending
        t = t * t * (3.0 - 2.0 * t)
        if 1.0 - t > 1e-4:
            vg_a.add([v.index], 1.0 - t, 'REPLACE')
        if t > 1e-4:
            vg_b.add([v.index], t, 'REPLACE')


def make_uv_sphere(name, segments, rings, radius, scale=(1, 1, 1), loc=(0, 0, 0), rot=(0, 0, 0)):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    rot_m = Euler(rot, 'XYZ').to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=rot_m, verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(loc), verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    set_smooth(obj)
    return obj


def make_tube(name, points, radii, segments=12, cap_start=True, cap_end=True):
    """Build a smooth skinned tube along 3D centerline points with per-ring radii."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    n = len(points)
    rings = []

    prev_up = Vector((0, 0, 1))
    for i in range(n):
        p = Vector(points[i])
        if i == 0:
            tangent = (Vector(points[1]) - p).normalized()
        elif i == n - 1:
            tangent = (p - Vector(points[i - 1])).normalized()
        else:
            tangent = (Vector(points[i + 1]) - Vector(points[i - 1])).normalized()

        if abs(tangent.dot(prev_up)) > 0.95:
            ref = Vector((1, 0, 0))
        else:
            ref = prev_up
        side = tangent.cross(ref).normalized()
        up = side.cross(tangent).normalized()
        prev_up = up

        r = radii[i]
        ring_verts = []
        for s in range(segments):
            ang = 2.0 * math.pi * s / segments
            offset = (side * math.cos(ang) + up * math.sin(ang)) * r
            ring_verts.append(bm.verts.new(p + offset))
        rings.append(ring_verts)

    for i in range(n - 1):
        r0 = rings[i]
        r1 = rings[i + 1]
        for s in range(segments):
            s_next = (s + 1) % segments
            bm.faces.new((r0[s], r0[s_next], r1[s_next], r1[s]))

    # Rounded dome caps
    if cap_start:
        p0 = Vector(points[0])
        t0 = (Vector(points[1]) - p0).normalized()
        tip = bm.verts.new(p0 - t0 * (radii[0] * 0.55))
        for s in range(segments):
            s_next = (s + 1) % segments
            bm.faces.new((rings[0][s_next], rings[0][s], tip))

    if cap_end:
        pn = Vector(points[-1])
        tn = (pn - Vector(points[-2])).normalized()
        tip = bm.verts.new(pn + tn * (radii[-1] * 0.65))
        for s in range(segments):
            s_next = (s + 1) % segments
            bm.faces.new((rings[-1][s], rings[-1][s_next], tip))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    set_smooth(obj)
    return obj


# ---------------------------------------------------------------------------
# Character Geometry Builders
# ---------------------------------------------------------------------------

def build_head_and_face(mats):
    outline_parts = []
    detail_parts = []

    # 1. Cranium (smooth stylized slightly-wide monkey head)
    head = make_uv_sphere("Head", segments=16, rings=10, radius=1.0,
                          scale=(0.255, 0.225, 0.225), loc=(0.0, 0.0, 0.955))
    # Subtle stylized cheek fullness & slightly flat crown
    for v in head.data.vertices:
        dz = v.co.z - 0.955
        if dz < 0:
            v.co.x *= 1.0 + 0.05 * min(1.0, -dz / 0.20)
        if dz > 0.14:
            v.co.z = 0.955 + 0.14 + (dz - 0.14) * 0.85
    head.data.update()
    assign_mat(head, mats["body"])
    assign_uniform_weight(head, "Head", 1.0)
    outline_parts.append(head)

    # 2. Pink Face Mask (sculpted heart/peanut monkey muzzle & brow arches)
    # Upper brow lobes (left & right) + seamless center bridge + wider lower cheek muzzle
    brow_l = make_uv_sphere("FaceBrow_L", segments=10, rings=6, radius=1.0,
                            scale=(0.098, 0.068, 0.094), loc=(0.064, -0.178, 0.995))
    brow_r = make_uv_sphere("FaceBrow_R", segments=10, rings=6, radius=1.0,
                            scale=(0.098, 0.068, 0.094), loc=(-0.064, -0.178, 0.995))
    brow_mid = make_uv_sphere("FaceBrow_Mid", segments=8, rings=5, radius=1.0,
                              scale=(0.072, 0.064, 0.065), loc=(0.0, -0.180, 0.968))
    muzzle = make_uv_sphere("FaceMuzzle", segments=14, rings=8, radius=1.0,
                            scale=(0.185, 0.088, 0.105), loc=(0.0, -0.170, 0.885))
    # Flatten front of muzzle slightly for clean cartoon face plane
    for v in muzzle.data.vertices:
        if v.co.y < -0.238:
            v.co.y = -0.238 + (v.co.y + 0.238) * 0.35
    muzzle.data.update()

    for part in (brow_l, brow_r, brow_mid, muzzle):
        assign_mat(part, mats["pink"])
        assign_uniform_weight(part, "Head", 1.0)
        detail_parts.append(part)

    # 3. Ears (left & right: lavender outer ear + recessed pink inner ear)
    for side, sgn in (("L", 1.0), ("R", -1.0)):
        ear = make_uv_sphere(f"Ear_{side}", segments=10, rings=6, radius=1.0,
                             scale=(0.082, 0.040, 0.088),
                             loc=(sgn * 0.275, -0.005, 0.965),
                             rot=(0.0, 0.0, sgn * -0.18))
        assign_mat(ear, mats["body"])
        assign_uniform_weight(ear, "Head", 1.0)
        outline_parts.append(ear)

        inner = make_uv_sphere(f"EarInner_{side}", segments=8, rings=5, radius=1.0,
                               scale=(0.054, 0.022, 0.058),
                               loc=(sgn * 0.276, -0.028, 0.965),
                               rot=(0.0, 0.0, sgn * -0.18))
        assign_mat(inner, mats["pink"])
        assign_uniform_weight(inner, "Head", 1.0)
        detail_parts.append(inner)

    # 4. Three White/Pink Head Tufts on Crown (fanning gently toward +X like ref)
    tuft_specs = [
        ("Tuft_1", (-0.042, -0.012, 1.155), (0.046, 0.028, 0.120), (0.06, -0.14, 0.08)),
        ("Tuft_2", (0.020, -0.010, 1.158),  (0.044, 0.028, 0.125), (0.05, 0.26, 0.04)),
        ("Tuft_3", (0.072, -0.006, 1.138),  (0.038, 0.025, 0.100), (0.04, 0.66, -0.04)),
    ]
    for tname, base_loc, sc, rot in tuft_specs:
        mesh = bpy.data.meshes.new(tname)
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=1.0)
        # Shift so base sits at origin and tapers softly toward rounded petal tip
        for v in bm.verts:
            z01 = (v.co.z + 1.0) * 0.5  # 0 at base, 1 at tip
            width_fac = 0.72 + 0.35 * math.sin(z01 * math.pi)
            v.co.x *= sc[0] * width_fac
            v.co.y *= sc[1] * (0.85 + 0.2 * math.sin(z01 * math.pi))
            v.co.z = (v.co.z + 0.85) * sc[2]
        rot_m = Euler(rot, 'XYZ').to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=rot_m, verts=bm.verts)
        bmesh.ops.translate(bm, vec=Vector(base_loc), verts=bm.verts)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(mesh)
        bm.free()

        tuft = bpy.data.objects.new(tname, mesh)
        bpy.context.collection.objects.link(tuft)
        set_smooth(tuft)
        # Two-tone white front/outer & pink inner/stripe matching reference
        tuft.data.materials.append(mats["tuft_white"])
        tuft.data.materials.append(mats["pink"])
        for p in tuft.data.polygons:
            # Give the back/inner underside a soft pink lining
            if p.normal.y > 0.25 or (p.center.x > base_loc[0] + 0.015 and p.normal.x > 0.3):
                p.material_index = 1
            else:
                p.material_index = 0
        assign_gradient_weights(tuft, "Head", "Tufts", lambda co: co.z, 1.14, 1.28)
        outline_parts.append(tuft)

    # 5. Expressive Eyes, Pupils, Nostrils & Smiling Mouth (detail_parts, no outline hull)
    for side, sgn in (("L", 1.0), ("R", -1.0)):
        eye = make_uv_sphere(f"EyeWhite_{side}", segments=10, rings=6, radius=1.0,
                             scale=(0.036, 0.015, 0.045),
                             loc=(sgn * 0.068, -0.236, 0.992))
        assign_mat(eye, mats["eye_white"])
        assign_uniform_weight(eye, "Head", 1.0)
        detail_parts.append(eye)

        pupil = make_uv_sphere(f"Pupil_{side}", segments=8, rings=5, radius=1.0,
                               scale=(0.019, 0.011, 0.026),
                               loc=(sgn * 0.066, -0.246, 0.990))
        assign_mat(pupil, mats["dark"])
        assign_uniform_weight(pupil, "Head", 1.0)
        detail_parts.append(pupil)

        nostril = make_uv_sphere(f"Nostril_{side}", segments=6, rings=4, radius=1.0,
                                 scale=(0.009, 0.007, 0.008),
                                 loc=(sgn * 0.022, -0.250, 0.922))
        assign_mat(nostril, mats["dark"])
        assign_uniform_weight(nostril, "Head", 1.0)
        detail_parts.append(nostril)

    # Smiling mouth arc
    smile_pts = []
    smile_r = []
    num_pts = 9
    for i in range(num_pts):
        t = (i / (num_pts - 1)) * 2.0 - 1.0  # -1 .. +1
        x = t * 0.088
        z = 0.858 + 0.024 * (t * t)
        # Hug the front curvature of the muzzle
        y = -0.252 + 0.022 * (t * t)
        smile_pts.append((x, y, z))
        smile_r.append(0.0075 * (1.0 - 0.25 * (t * t)))
    smile = make_tube("Smile", smile_pts, smile_r, segments=6)
    assign_mat(smile, mats["dark"])
    assign_uniform_weight(smile, "Head", 1.0)
    detail_parts.append(smile)

    return outline_parts, detail_parts


def build_torso_and_belly(mats):
    outline_parts = []
    detail_parts = []

    # Compact plump pear-shaped monkey torso (Z = 0.37 .. 0.76)
    torso = make_uv_sphere("Torso", segments=14, rings=10, radius=1.0,
                           scale=(0.195, 0.165, 0.205), loc=(0.0, 0.0, 0.565))
    for v in torso.data.vertices:
        dz = v.co.z - 0.565
        # Slightly wider belly/hips, gently narrower shoulders/neck
        if dz < 0:
            w = 1.0 + 0.08 * min(1.0, -dz / 0.18)
            v.co.x *= w
            v.co.y *= w
        else:
            w = 1.0 - 0.14 * min(1.0, dz / 0.20)
            v.co.x *= w
            v.co.y *= w
    torso.data.update()
    assign_mat(torso, mats["body"])

    # Smooth 3-bone spine weighting: Hips (<=0.48) -> Spine (0.56) -> Chest (>=0.66)
    vg_hips = torso.vertex_groups.new(name="Hips")
    vg_spine = torso.vertex_groups.new(name="Spine")
    vg_chest = torso.vertex_groups.new(name="Chest")
    for v in torso.data.vertices:
        z = v.co.z
        if z <= 0.45:
            vg_hips.add([v.index], 1.0, 'REPLACE')
        elif z <= 0.58:
            t = (z - 0.45) / 0.13
            t = t * t * (3.0 - 2.0 * t)
            vg_hips.add([v.index], 1.0 - t, 'REPLACE')
            vg_spine.add([v.index], t, 'REPLACE')
        elif z <= 0.69:
            t = (z - 0.58) / 0.11
            t = t * t * (3.0 - 2.0 * t)
            vg_spine.add([v.index], 1.0 - t, 'REPLACE')
            vg_chest.add([v.index], t, 'REPLACE')
        else:
            vg_chest.add([v.index], 1.0, 'REPLACE')
    outline_parts.append(torso)

    # Bright Yellow Circular Belly Patch (clean smooth polar disc hugging front torso)
    mesh = bpy.data.meshes.new("BellyPatch")
    bm = bmesh.new()

    def torso_front_pos(x, z, offset_y):
        dz = z - 0.565
        w = (1.0 + 0.08 * min(1.0, -dz / 0.18)) if dz < 0 else (1.0 - 0.14 * min(1.0, dz / 0.20))
        rx = 0.195 * w
        ry = 0.165 * w
        rz = 0.205
        val = max(0.01, 1.0 - (x / rx) ** 2 - (dz / rz) ** 2)
        y_surf = -ry * math.sqrt(val)
        return Vector((x, y_surf - offset_y, z))

    segs = 18
    center_v = bm.verts.new(torso_front_pos(0.0, 0.545, 0.0155))
    # Concentric rings: inner, outer face (clear of 0.0125 torso outline), and beveled rim
    ring_defs = [
        (0.50, 0.0155),
        (0.92, 0.0145),
        (1.00, 0.0110),
        (1.00, -0.0060),
    ]
    rings = []
    for r_fac, off_y in ring_defs:
        r_verts = []
        for s in range(segs):
            ang = 2.0 * math.pi * s / segs
            px = math.cos(ang) * 0.114 * r_fac
            pz = 0.545 + math.sin(ang) * 0.112 * r_fac
            r_verts.append(bm.verts.new(torso_front_pos(px, pz, off_y)))
        rings.append(r_verts)

    for s in range(segs):
        sn = (s + 1) % segs
        bm.faces.new((center_v, rings[0][sn], rings[0][s]))
    for ri in range(len(rings) - 1):
        r0, r1 = rings[ri], rings[ri + 1]
        for s in range(segs):
            sn = (s + 1) % segs
            bm.faces.new((r0[s], r0[sn], r1[sn], r1[s]))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    belly = bpy.data.objects.new("BellyPatch", mesh)
    bpy.context.collection.objects.link(belly)
    set_smooth(belly)
    assign_mat(belly, mats["yellow"])
    # Identical spine weight gradient so belly patch never detaches from torso
    vg_h = belly.vertex_groups.new(name="Hips")
    vg_s = belly.vertex_groups.new(name="Spine")
    vg_c = belly.vertex_groups.new(name="Chest")
    for v in belly.data.vertices:
        z = v.co.z
        if z <= 0.45:
            vg_h.add([v.index], 1.0, 'REPLACE')
        elif z <= 0.58:
            t = (z - 0.45) / 0.13
            t = t * t * (3.0 - 2.0 * t)
            vg_h.add([v.index], 1.0 - t, 'REPLACE')
            vg_s.add([v.index], t, 'REPLACE')
        elif z <= 0.69:
            t = (z - 0.58) / 0.11
            t = t * t * (3.0 - 2.0 * t)
            vg_s.add([v.index], 1.0 - t, 'REPLACE')
            vg_c.add([v.index], t, 'REPLACE')
        else:
            vg_c.add([v.index], 1.0, 'REPLACE')
    detail_parts.append(belly)

    return outline_parts, detail_parts


def build_arms_and_hands(mats):
    outline_parts = []

    for side, sgn in (("L", 1.0), ("R", -1.0)):
        # Natural A-pose arm matching reference
        pts = [
            (sgn * 0.165, 0.005, 0.675),
            (sgn * 0.225, 0.000, 0.605),
            (sgn * 0.285, -0.010, 0.530),  # Elbow
            (sgn * 0.318, -0.022, 0.455),
            (sgn * 0.335, -0.032, 0.395),  # Wrist
        ]
        radii = [0.064, 0.058, 0.054, 0.050, 0.048]
        arm = make_tube(f"Arm_{side}", pts, radii, segments=8, cap_start=True, cap_end=True)
        assign_mat(arm, mats["body"])
        assign_gradient_weights(arm, f"UpperArm.{side}", f"LowerArm.{side}",
                                lambda co: -co.z, -0.575, -0.485)
        outline_parts.append(arm)

        # Pink Hand (chunky stylized palm/mitten + distinct thumb)
        hand = make_uv_sphere(f"Hand_{side}", segments=8, rings=6, radius=1.0,
                              scale=(0.052, 0.046, 0.064),
                              loc=(sgn * 0.336, -0.038, 0.342),
                              rot=(0.12, sgn * 0.18, 0.0))
        assign_mat(hand, mats["pink"])
        assign_uniform_weight(hand, f"LowerArm.{side}", 1.0)
        outline_parts.append(hand)

        thumb = make_uv_sphere(f"Thumb_{side}", segments=6, rings=5, radius=1.0,
                               scale=(0.024, 0.024, 0.036),
                               loc=(sgn * 0.292, -0.062, 0.352),
                               rot=(0.35, sgn * -0.55, 0.0))
        assign_mat(thumb, mats["pink"])
        assign_uniform_weight(thumb, f"LowerArm.{side}", 1.0)
        outline_parts.append(thumb)

    return outline_parts


def build_legs_and_boots(mats):
    outline_parts = []

    for side, sgn in (("L", 1.0), ("R", -1.0)):
        # Short lavender thigh tucking into the red boot
        leg_pts = [
            (sgn * 0.105, 0.0, 0.415),
            (sgn * 0.110, 0.0, 0.325),
            (sgn * 0.112, 0.0, 0.235),
        ]
        leg = make_tube(f"Leg_{side}", leg_pts, [0.072, 0.066, 0.062], segments=8)
        assign_mat(leg, mats["body"])
        assign_gradient_weights(leg, f"UpperLeg.{side}", f"Boot.{side}",
                                lambda co: -co.z, -0.29, -0.22)
        outline_parts.append(leg)

        # Glossy Red Rubber Boot (shaft + cuffed collar + chunky toe box + beveled sole)
        yaw = sgn * -0.14  # Slight cute outward foot turn matching ref
        boot_cx = sgn * 0.115

        # Boot shaft
        shaft_pts = [
            (boot_cx, 0.0, 0.270),
            (boot_cx, 0.0, 0.180),
            (boot_cx, 0.0, 0.075),
        ]
        shaft = make_tube(f"BootShaft_{side}", shaft_pts, [0.080, 0.076, 0.080], segments=10)
        assign_mat(shaft, mats["boot_red"])
        assign_uniform_weight(shaft, f"Boot.{side}", 1.0)
        outline_parts.append(shaft)

        # Rolled boot top collar cuff
        mesh_cuff = bpy.data.meshes.new(f"BootCuff_{side}")
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=10,
                              radius1=0.086, radius2=0.088, depth=0.034)
        bmesh.ops.translate(bm, vec=Vector((boot_cx, 0.0, 0.268)), verts=bm.verts)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(mesh_cuff)
        bm.free()
        cuff = bpy.data.objects.new(f"BootCuff_{side}", mesh_cuff)
        bpy.context.collection.objects.link(cuff)
        set_smooth(cuff)
        assign_mat(cuff, mats["boot_red"])
        assign_uniform_weight(cuff, f"Boot.{side}", 1.0)
        outline_parts.append(cuff)

        # Plump rounded boot toe box
        toe = make_uv_sphere(f"BootToe_{side}", segments=10, rings=8, radius=1.0,
                             scale=(0.082, 0.125, 0.070),
                             loc=(boot_cx + sgn * 0.010, -0.068, 0.086),
                             rot=(0.0, 0.0, yaw))
        # Flatten bottom of toe box cleanly above sole
        for v in toe.data.vertices:
            if v.co.z < 0.034:
                v.co.z = 0.034
        toe.data.update()
        assign_mat(toe, mats["boot_red"])
        assign_uniform_weight(toe, f"Boot.{side}", 1.0)
        outline_parts.append(toe)

        # Beveled dark-red rubber sole sitting flush at Z = 0.00
        mesh_sole = bpy.data.meshes.new(f"BootSole_{side}")
        bm = bmesh.new()
        # Build beveled oval sole with 3 vertical rings: bottom (Z=0.00), mid (Z=0.014), top (Z=0.036)
        segs = 10
        sole_rings = []
        ring_specs = [
            (0.000, 0.90),  # Beveled bottom edge resting on Z = 0.00
            (0.014, 1.00),  # Full outer sole rim
            (0.036, 0.94),  # Top edge tucking into boot upper
        ]
        rot_z = Matrix.Rotation(yaw, 3, 'Z')
        center_xy = Vector((boot_cx + sgn * 0.008, -0.062, 0.0))
        for z_h, r_fac in ring_specs:
            r_verts = []
            for s in range(segs):
                ang = 2.0 * math.pi * s / segs
                lx = math.cos(ang) * 0.088 * r_fac
                ly = math.sin(ang) * 0.132 * r_fac
                p = rot_z @ Vector((lx, ly, 0.0)) + center_xy
                p.z = z_h
                r_verts.append(bm.verts.new(p))
            sole_rings.append(r_verts)
        for ri in range(len(sole_rings) - 1):
            r0, r1 = sole_rings[ri], sole_rings[ri + 1]
            for s in range(segs):
                sn = (s + 1) % segs
                bm.faces.new((r0[s], r0[sn], r1[sn], r1[s]))
        # Cap bottom & top
        bm.faces.new(list(reversed(sole_rings[0])))
        bm.faces.new(sole_rings[-1])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(mesh_sole)
        bm.free()

        sole = bpy.data.objects.new(f"BootSole_{side}", mesh_sole)
        bpy.context.collection.objects.link(sole)
        set_smooth(sole)
        assign_mat(sole, mats["boot_sole"])
        assign_uniform_weight(sole, f"Boot.{side}", 1.0)
        outline_parts.append(sole)

    return outline_parts


def build_tail(mats):
    # Cute expressive S-curved monkey tail curling upward behind the body
    pts = [
        (0.0, 0.135, 0.435),
        (0.0, 0.220, 0.395),
        (0.0, 0.315, 0.385),
        (0.0, 0.405, 0.425),
        (0.0, 0.470, 0.505),
        (0.0, 0.492, 0.595),
        (0.0, 0.455, 0.665),
        (0.0, 0.395, 0.675),
        (0.0, 0.375, 0.625),
    ]
    radii = [0.038, 0.034, 0.031, 0.030, 0.029, 0.028, 0.029, 0.031, 0.026]
    tail = make_tube("Tail", pts, radii, segments=8, cap_start=True, cap_end=True)
    assign_mat(tail, mats["body"])

    # Smooth 3-segment tail weights: Hips -> Tail.01 -> Tail.02 -> Tail.03
    vg_h = tail.vertex_groups.new(name="Hips")
    vg_1 = tail.vertex_groups.new(name="Tail.01")
    vg_2 = tail.vertex_groups.new(name="Tail.02")
    vg_3 = tail.vertex_groups.new(name="Tail.03")

    # Compute arc-length parameter t in [0, 1] along centerline
    arc_pts = [Vector(p) for p in pts]
    cum_len = [0.0]
    for i in range(1, len(arc_pts)):
        cum_len.append(cum_len[-1] + (arc_pts[i] - arc_pts[i - 1]).length)
    total_len = cum_len[-1]

    for v in tail.data.vertices:
        best_d = 1e9
        best_t = 0.0
        for i, p in enumerate(arc_pts):
            d = (v.co - p).length
            if d < best_d:
                best_d = d
                best_t = cum_len[i] / total_len
        if best_t < 0.15:
            u = best_t / 0.15
            vg_h.add([v.index], 1.0 - u, 'REPLACE')
            vg_1.add([v.index], u, 'REPLACE')
        elif best_t < 0.50:
            u = (best_t - 0.15) / 0.35
            vg_1.add([v.index], 1.0 - u, 'REPLACE')
            vg_2.add([v.index], u, 'REPLACE')
        else:
            u = min(1.0, (best_t - 0.50) / 0.35)
            vg_2.add([v.index], 1.0 - u, 'REPLACE')
            vg_3.add([v.index], u, 'REPLACE')

    return [tail]


def join_objects(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    joined = bpy.context.active_object
    joined.name = name
    return joined


def apply_inverted_hull_outline(obj, outline_mat, thickness=0.013):
    """
    Add and bake a Solidify inverted-hull outline shell onto obj.
    Vertex groups are preserved automatically onto the solidified shell.
    """
    if outline_mat.name not in [m.name for m in obj.data.materials]:
        obj.data.materials.append(outline_mat)
    outline_idx = len(obj.data.materials) - 1

    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    mod = obj.modifiers.new(name="Outline_Solidify", type='SOLIDIFY')
    mod.thickness = thickness
    mod.offset = 1.0            # Expand outward along normals
    mod.use_even_offset = True
    mod.use_rim = False
    mod.use_flip_normals = True  # Flip outer shell normals inward -> backface culled
    mod.material_offset = outline_idx

    bpy.ops.object.modifier_apply(modifier=mod.name)


def uv_unwrap_object(obj):
    """Generate clean automatic UVs for glTF compatibility."""
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.02)
    bpy.ops.object.mode_set(mode='OBJECT')


# ---------------------------------------------------------------------------
# Armature Construction
# ---------------------------------------------------------------------------

def build_armature():
    arm_data = bpy.data.armatures.new("Tarcy_Armature")
    arm_obj = bpy.data.objects.new("Tarcy_Armature", arm_data)
    bpy.context.collection.objects.link(arm_obj)

    bpy.ops.object.select_all(action='DESELECT')
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')

    eb = arm_data.edit_bones

    def add_bone(name, head, tail, parent=None, connect=False):
        b = eb.new(name)
        b.head = Vector(head)
        b.tail = Vector(tail)
        if parent:
            b.parent = eb[parent]
            b.use_connect = connect
        return b

    add_bone("Root",       (0.0, 0.0, 0.00), (0.0, 0.0, 0.22))
    add_bone("Hips",       (0.0, 0.0, 0.40), (0.0, 0.0, 0.50), parent="Root")
    add_bone("Spine",      (0.0, 0.0, 0.50), (0.0, 0.0, 0.64), parent="Hips", connect=True)
    add_bone("Chest",      (0.0, 0.0, 0.64), (0.0, 0.0, 0.75), parent="Spine", connect=True)
    add_bone("Head",       (0.0, 0.0, 0.75), (0.0, 0.0, 1.15), parent="Chest", connect=True)
    add_bone("Tufts",      (0.0, -0.01, 1.15), (0.02, -0.01, 1.35), parent="Head", connect=False)

    # Arms
    for side, sgn in (("L", 1.0), ("R", -1.0)):
        add_bone(f"UpperArm.{side}", (sgn * 0.17, 0.0, 0.67), (sgn * 0.285, -0.01, 0.53),
                 parent="Chest")
        add_bone(f"LowerArm.{side}", (sgn * 0.285, -0.01, 0.53), (sgn * 0.34, -0.038, 0.34),
                 parent=f"UpperArm.{side}", connect=True)

    # Legs & Boots
    for side, sgn in (("L", 1.0), ("R", -1.0)):
        add_bone(f"UpperLeg.{side}", (sgn * 0.105, 0.0, 0.40), (sgn * 0.112, 0.0, 0.23),
                 parent="Hips")
        add_bone(f"Boot.{side}",     (sgn * 0.112, 0.0, 0.23), (sgn * 0.120, -0.10, 0.06),
                 parent=f"UpperLeg.{side}", connect=True)

    # Tail
    add_bone("Tail.01", (0.0, 0.135, 0.435), (0.0, 0.315, 0.385), parent="Hips")
    add_bone("Tail.02", (0.0, 0.315, 0.385), (0.0, 0.470, 0.505), parent="Tail.01", connect=True)
    add_bone("Tail.03", (0.0, 0.470, 0.505), (0.0, 0.395, 0.675), parent="Tail.02", connect=True)

    bpy.ops.object.mode_set(mode='OBJECT')
    return arm_obj


def bind_mesh_to_armature(mesh_obj, arm_obj):
    mesh_obj.parent = arm_obj
    mod = mesh_obj.modifiers.new(name="Armature", type='ARMATURE')
    mod.object = arm_obj
    mod.use_vertex_groups = True


# ---------------------------------------------------------------------------
# Animation Authoring (All 8 Required NLA Clips)
# ---------------------------------------------------------------------------

def reset_pose(arm_obj):
    for pb in arm_obj.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.location = (0.0, 0.0, 0.0)
        pb.rotation_euler = (0.0, 0.0, 0.0)
        pb.scale = (1.0, 1.0, 1.0)


def key_pose(arm_obj, frame, pose_dict):
    """
    pose_dict: { bone_name: {"loc": (x,y,z), "rot": (rx_deg, ry_deg, rz_deg)} }
    Inserts keyframes for all specified bones (or rest if omitted when listed).
    """
    for bname, vals in pose_dict.items():
        pb = arm_obj.pose.bones[bname]
        pb.rotation_mode = 'XYZ'
        if "loc" in vals:
            pb.location = Vector(vals["loc"])
            pb.keyframe_insert(data_path="location", frame=frame)
        if "rot" in vals:
            rx, ry, rz = vals["rot"]
            pb.rotation_euler = Euler((math.radians(rx), math.radians(ry), math.radians(rz)), 'XYZ')
            pb.keyframe_insert(data_path="rotation_euler", frame=frame)


def build_action_nla(arm_obj, name, frame_end, keyframes):
    """
    Create an Action, keyframe all poses, and push to an NLA track named `name`.
    keyframes: list of (frame, pose_dict)
    """
    if not arm_obj.animation_data:
        arm_obj.animation_data_create()

    act = bpy.data.actions.new(name=name)
    arm_obj.animation_data.action = act
    reset_pose(arm_obj)

    for frame, pose_dict in keyframes:
        key_pose(arm_obj, frame, pose_dict)

    trk = arm_obj.animation_data.nla_tracks.new()
    trk.name = name
    strip = trk.strips.new(name, 1, act)
    strip.action_frame_start = 1
    strip.action_frame_end = frame_end
    if hasattr(arm_obj.animation_data, "action_slot") and arm_obj.animation_data.action_slot:
        strip.action_slot = arm_obj.animation_data.action_slot

    arm_obj.animation_data.action = None
    reset_pose(arm_obj)


def build_all_animations(arm_obj):
    bpy.context.scene.render.fps = 24
    bpy.ops.object.select_all(action='DESELECT')
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='POSE')

    # 1. Idle (1..48, gentle breathing + look + tail sway)
    idle_keys = [
        (1, {
            "Hips": {"loc": (0, 0, 0.0), "rot": (0, 0, 0)},
            "Spine": {"rot": (2, 0, 0)},
            "Chest": {"rot": (0, 0, 0)},
            "Head": {"rot": (0, 0, 0)},
            "Tufts": {"rot": (0, 0, 0)},
            "UpperArm.L": {"rot": (0, 0, 0)}, "LowerArm.L": {"rot": (6, 0, 0)},
            "UpperArm.R": {"rot": (0, 0, 0)}, "LowerArm.R": {"rot": (6, 0, 0)},
            "Tail.01": {"rot": (0, 0, -10)}, "Tail.02": {"rot": (4, 0, -12)}, "Tail.03": {"rot": (6, 0, -8)},
        }),
        (12, {
            "Hips": {"loc": (0, 0, 0.016), "rot": (0, 0, 2)},
            "Spine": {"rot": (-2, 0, 2)},
            "Chest": {"rot": (-2, 0, 0)},
            "Head": {"rot": (-3, 0, 6)},
            "Tufts": {"rot": (-6, 0, 0)},
            "UpperArm.L": {"rot": (4, 0, -4)}, "LowerArm.L": {"rot": (10, 0, 0)},
            "UpperArm.R": {"rot": (-3, 0, 4)}, "LowerArm.R": {"rot": (10, 0, 0)},
            "Tail.01": {"rot": (4, 0, 2)}, "Tail.02": {"rot": (8, 0, 6)}, "Tail.03": {"rot": (10, 0, 10)},
        }),
        (24, {
            "Hips": {"loc": (0, 0, 0.002), "rot": (0, 0, 0)},
            "Spine": {"rot": (2, 0, 0)},
            "Chest": {"rot": (1, 0, 0)},
            "Head": {"rot": (2, 0, 0)},
            "Tufts": {"rot": (4, 0, 0)},
            "UpperArm.L": {"rot": (0, 0, 0)}, "LowerArm.L": {"rot": (6, 0, 0)},
            "UpperArm.R": {"rot": (0, 0, 0)}, "LowerArm.R": {"rot": (6, 0, 0)},
            "Tail.01": {"rot": (0, 0, 12)}, "Tail.02": {"rot": (4, 0, 14)}, "Tail.03": {"rot": (6, 0, 10)},
        }),
        (36, {
            "Hips": {"loc": (0, 0, 0.016), "rot": (0, 0, -2)},
            "Spine": {"rot": (-2, 0, -2)},
            "Chest": {"rot": (-2, 0, 0)},
            "Head": {"rot": (-2, 0, -7)},
            "Tufts": {"rot": (-5, 0, 0)},
            "UpperArm.L": {"rot": (-3, 0, -3)}, "LowerArm.L": {"rot": (10, 0, 0)},
            "UpperArm.R": {"rot": (4, 0, 3)}, "LowerArm.R": {"rot": (10, 0, 0)},
            "Tail.01": {"rot": (-4, 0, -2)}, "Tail.02": {"rot": (-2, 0, -6)}, "Tail.03": {"rot": (0, 0, -10)},
        }),
        (48, {
            "Hips": {"loc": (0, 0, 0.0), "rot": (0, 0, 0)},
            "Spine": {"rot": (2, 0, 0)},
            "Chest": {"rot": (0, 0, 0)},
            "Head": {"rot": (0, 0, 0)},
            "Tufts": {"rot": (0, 0, 0)},
            "UpperArm.L": {"rot": (0, 0, 0)}, "LowerArm.L": {"rot": (6, 0, 0)},
            "UpperArm.R": {"rot": (0, 0, 0)}, "LowerArm.R": {"rot": (6, 0, 0)},
            "Tail.01": {"rot": (0, 0, -10)}, "Tail.02": {"rot": (4, 0, -12)}, "Tail.03": {"rot": (6, 0, -8)},
        }),
    ]
    build_action_nla(arm_obj, "Idle", 48, idle_keys)

    # 2. Walk (1..24, jaunty monkey stride)
    walk_keys = [
        (1, {
            "Hips": {"loc": (0, 0, 0.0), "rot": (4, 0, 6)},
            "Spine": {"rot": (6, 0, -4)},
            "Head": {"rot": (-4, 0, -2)},
            "Tufts": {"rot": (-6, 0, 0)},
            "UpperLeg.L": {"rot": (28, 0, 0)}, "Boot.L": {"rot": (-12, 0, 0)},
            "UpperLeg.R": {"rot": (-26, 0, 0)}, "Boot.R": {"rot": (14, 0, 0)},
            "UpperArm.L": {"rot": (-24, 0, 0)}, "LowerArm.L": {"rot": (18, 0, 0)},
            "UpperArm.R": {"rot": (26, 0, 0)}, "LowerArm.R": {"rot": (12, 0, 0)},
            "Tail.01": {"rot": (6, 0, 14)}, "Tail.02": {"rot": (8, 0, 10)}, "Tail.03": {"rot": (6, 0, 8)},
        }),
        (7, {
            "Hips": {"loc": (0, 0, 0.032), "rot": (2, 0, 0)},
            "Spine": {"rot": (4, 0, 0)},
            "Head": {"rot": (-2, 0, 0)},
            "Tufts": {"rot": (8, 0, 0)},
            "UpperLeg.L": {"rot": (4, 0, 0)}, "Boot.L": {"rot": (4, 0, 0)},
            "UpperLeg.R": {"rot": (8, 0, 0)}, "Boot.R": {"rot": (-22, 0, 0)},
            "UpperArm.L": {"rot": (0, 0, 0)}, "LowerArm.L": {"rot": (14, 0, 0)},
            "UpperArm.R": {"rot": (0, 0, 0)}, "LowerArm.R": {"rot": (14, 0, 0)},
            "Tail.01": {"rot": (-4, 0, 0)}, "Tail.02": {"rot": (2, 0, -4)}, "Tail.03": {"rot": (4, 0, -6)},
        }),
        (13, {
            "Hips": {"loc": (0, 0, 0.0), "rot": (4, 0, -6)},
            "Spine": {"rot": (6, 0, 4)},
            "Head": {"rot": (-4, 0, 2)},
            "Tufts": {"rot": (-6, 0, 0)},
            "UpperLeg.L": {"rot": (-26, 0, 0)}, "Boot.L": {"rot": (14, 0, 0)},
            "UpperLeg.R": {"rot": (28, 0, 0)}, "Boot.R": {"rot": (-12, 0, 0)},
            "UpperArm.L": {"rot": (26, 0, 0)}, "LowerArm.L": {"rot": (12, 0, 0)},
            "UpperArm.R": {"rot": (-24, 0, 0)}, "LowerArm.R": {"rot": (18, 0, 0)},
            "Tail.01": {"rot": (6, 0, -14)}, "Tail.02": {"rot": (8, 0, -10)}, "Tail.03": {"rot": (6, 0, -8)},
        }),
        (19, {
            "Hips": {"loc": (0, 0, 0.032), "rot": (2, 0, 0)},
            "Spine": {"rot": (4, 0, 0)},
            "Head": {"rot": (-2, 0, 0)},
            "Tufts": {"rot": (8, 0, 0)},
            "UpperLeg.L": {"rot": (8, 0, 0)}, "Boot.L": {"rot": (-22, 0, 0)},
            "UpperLeg.R": {"rot": (4, 0, 0)}, "Boot.R": {"rot": (4, 0, 0)},
            "UpperArm.L": {"rot": (0, 0, 0)}, "LowerArm.L": {"rot": (14, 0, 0)},
            "UpperArm.R": {"rot": (0, 0, 0)}, "LowerArm.R": {"rot": (14, 0, 0)},
            "Tail.01": {"rot": (-4, 0, 0)}, "Tail.02": {"rot": (2, 0, 4)}, "Tail.03": {"rot": (4, 0, 6)},
        }),
        (24, {
            "Hips": {"loc": (0, 0, 0.0), "rot": (4, 0, 6)},
            "Spine": {"rot": (6, 0, -4)},
            "Head": {"rot": (-4, 0, -2)},
            "Tufts": {"rot": (-6, 0, 0)},
            "UpperLeg.L": {"rot": (28, 0, 0)}, "Boot.L": {"rot": (-12, 0, 0)},
            "UpperLeg.R": {"rot": (-26, 0, 0)}, "Boot.R": {"rot": (14, 0, 0)},
            "UpperArm.L": {"rot": (-24, 0, 0)}, "LowerArm.L": {"rot": (18, 0, 0)},
            "UpperArm.R": {"rot": (26, 0, 0)}, "LowerArm.R": {"rot": (12, 0, 0)},
            "Tail.01": {"rot": (6, 0, 14)}, "Tail.02": {"rot": (8, 0, 10)}, "Tail.03": {"rot": (6, 0, 8)},
        }),
    ]
    build_action_nla(arm_obj, "Walk", 24, walk_keys)

    # 3. Run (1..16, energetic forward-leaning sprint)
    run_keys = [
        (1, {
            "Hips": {"loc": (0, 0, 0.010), "rot": (14, 0, 10)},
            "Spine": {"rot": (14, 0, -8)},
            "Chest": {"rot": (8, 0, -4)},
            "Head": {"rot": (-18, 0, 0)},
            "Tufts": {"rot": (-18, 0, 0)},
            "UpperLeg.L": {"rot": (48, 0, 0)}, "Boot.L": {"rot": (-28, 0, 0)},
            "UpperLeg.R": {"rot": (-42, 0, 0)}, "Boot.R": {"rot": (24, 0, 0)},
            "UpperArm.L": {"rot": (-46, 0, 0)}, "LowerArm.L": {"rot": (42, 0, 0)},
            "UpperArm.R": {"rot": (46, 0, 0)}, "LowerArm.R": {"rot": (34, 0, 0)},
            "Tail.01": {"rot": (-18, 0, 16)}, "Tail.02": {"rot": (-14, 0, 12)}, "Tail.03": {"rot": (-10, 0, 10)},
        }),
        (5, {
            "Hips": {"loc": (0, 0, 0.062), "rot": (12, 0, 0)},
            "Spine": {"rot": (12, 0, 0)},
            "Chest": {"rot": (6, 0, 0)},
            "Head": {"rot": (-14, 0, 0)},
            "Tufts": {"rot": (-8, 0, 0)},
            "UpperLeg.L": {"rot": (8, 0, 0)}, "Boot.L": {"rot": (-10, 0, 0)},
            "UpperLeg.R": {"rot": (12, 0, 0)}, "Boot.R": {"rot": (-36, 0, 0)},
            "UpperArm.L": {"rot": (0, 0, 0)}, "LowerArm.L": {"rot": (38, 0, 0)},
            "UpperArm.R": {"rot": (0, 0, 0)}, "LowerArm.R": {"rot": (38, 0, 0)},
            "Tail.01": {"rot": (-24, 0, 0)}, "Tail.02": {"rot": (-18, 0, -6)}, "Tail.03": {"rot": (-12, 0, -8)},
        }),
        (9, {
            "Hips": {"loc": (0, 0, 0.010), "rot": (14, 0, -10)},
            "Spine": {"rot": (14, 0, 8)},
            "Chest": {"rot": (8, 0, 4)},
            "Head": {"rot": (-18, 0, 0)},
            "Tufts": {"rot": (-18, 0, 0)},
            "UpperLeg.L": {"rot": (-42, 0, 0)}, "Boot.L": {"rot": (24, 0, 0)},
            "UpperLeg.R": {"rot": (48, 0, 0)}, "Boot.R": {"rot": (-28, 0, 0)},
            "UpperArm.L": {"rot": (46, 0, 0)}, "LowerArm.L": {"rot": (34, 0, 0)},
            "UpperArm.R": {"rot": (-46, 0, 0)}, "LowerArm.R": {"rot": (42, 0, 0)},
            "Tail.01": {"rot": (-18, 0, -16)}, "Tail.02": {"rot": (-14, 0, -12)}, "Tail.03": {"rot": (-10, 0, -10)},
        }),
        (13, {
            "Hips": {"loc": (0, 0, 0.062), "rot": (12, 0, 0)},
            "Spine": {"rot": (12, 0, 0)},
            "Chest": {"rot": (6, 0, 0)},
            "Head": {"rot": (-14, 0, 0)},
            "Tufts": {"rot": (-8, 0, 0)},
            "UpperLeg.L": {"rot": (12, 0, 0)}, "Boot.L": {"rot": (-36, 0, 0)},
            "UpperLeg.R": {"rot": (8, 0, 0)}, "Boot.R": {"rot": (-10, 0, 0)},
            "UpperArm.L": {"rot": (0, 0, 0)}, "LowerArm.L": {"rot": (38, 0, 0)},
            "UpperArm.R": {"rot": (0, 0, 0)}, "LowerArm.R": {"rot": (38, 0, 0)},
            "Tail.01": {"rot": (-24, 0, 0)}, "Tail.02": {"rot": (-18, 0, 6)}, "Tail.03": {"rot": (-12, 0, 8)},
        }),
        (16, {
            "Hips": {"loc": (0, 0, 0.010), "rot": (14, 0, 10)},
            "Spine": {"rot": (14, 0, -8)},
            "Chest": {"rot": (8, 0, -4)},
            "Head": {"rot": (-18, 0, 0)},
            "Tufts": {"rot": (-18, 0, 0)},
            "UpperLeg.L": {"rot": (48, 0, 0)}, "Boot.L": {"rot": (-28, 0, 0)},
            "UpperLeg.R": {"rot": (-42, 0, 0)}, "Boot.R": {"rot": (24, 0, 0)},
            "UpperArm.L": {"rot": (-46, 0, 0)}, "LowerArm.L": {"rot": (42, 0, 0)},
            "UpperArm.R": {"rot": (46, 0, 0)}, "LowerArm.R": {"rot": (34, 0, 0)},
            "Tail.01": {"rot": (-18, 0, 16)}, "Tail.02": {"rot": (-14, 0, 12)}, "Tail.03": {"rot": (-10, 0, 10)},
        }),
    ]
    build_action_nla(arm_obj, "Run", 16, run_keys)

    # 4. Chop_Mine (1..24, overhead two-handed tool swing)
    chop_keys = [
        (1, {
            "Hips": {"loc": (0, 0, 0.0), "rot": (4, 0, 0)},
            "Spine": {"rot": (6, 0, 0)},
            "Head": {"rot": (-4, 0, 0)},
            "Tufts": {"rot": (0, 0, 0)},
            "UpperArm.L": {"rot": (35, 0, -18)}, "LowerArm.L": {"rot": (30, 0, 14)},
            "UpperArm.R": {"rot": (35, 0, 18)}, "LowerArm.R": {"rot": (30, 0, -14)},
            "Tail.01": {"rot": (0, 0, 0)}, "Tail.02": {"rot": (4, 0, 0)},
        }),
        (9, {
            "Hips": {"loc": (0, 0, 0.035), "rot": (-12, 0, 0)},
            "Spine": {"rot": (-16, 0, 0)},
            "Head": {"rot": (-10, 0, 0)},
            "Tufts": {"rot": (-18, 0, 0)},
            "UpperArm.L": {"rot": (132, 0, -24)}, "LowerArm.L": {"rot": (22, 0, 16)},
            "UpperArm.R": {"rot": (132, 0, 24)}, "LowerArm.R": {"rot": (22, 0, -16)},
            "Tail.01": {"rot": (18, 0, 0)}, "Tail.02": {"rot": (16, 0, 0)},
        }),
        (14, {
            "Hips": {"loc": (0, 0, -0.055), "rot": (22, 0, 0)},
            "Spine": {"rot": (26, 0, 0)},
            "Head": {"rot": (14, 0, 0)},
            "Tufts": {"rot": (22, 0, 0)},
            "UpperLeg.L": {"rot": (-16, 0, 0)}, "Boot.L": {"rot": (16, 0, 0)},
            "UpperLeg.R": {"rot": (-16, 0, 0)}, "Boot.R": {"rot": (16, 0, 0)},
            "UpperArm.L": {"rot": (12, 0, -22)}, "LowerArm.L": {"rot": (18, 0, 18)},
            "UpperArm.R": {"rot": (12, 0, 22)}, "LowerArm.R": {"rot": (18, 0, -18)},
            "Tail.01": {"rot": (-22, 0, 0)}, "Tail.02": {"rot": (-14, 0, 0)},
        }),
        (24, {
            "Hips": {"loc": (0, 0, 0.0), "rot": (4, 0, 0)},
            "Spine": {"rot": (6, 0, 0)},
            "Head": {"rot": (-4, 0, 0)},
            "Tufts": {"rot": (0, 0, 0)},
            "UpperLeg.L": {"rot": (0, 0, 0)}, "Boot.L": {"rot": (0, 0, 0)},
            "UpperLeg.R": {"rot": (0, 0, 0)}, "Boot.R": {"rot": (0, 0, 0)},
            "UpperArm.L": {"rot": (35, 0, -18)}, "LowerArm.L": {"rot": (30, 0, 14)},
            "UpperArm.R": {"rot": (35, 0, 18)}, "LowerArm.R": {"rot": (30, 0, -14)},
            "Tail.01": {"rot": (0, 0, 0)}, "Tail.02": {"rot": (4, 0, 0)},
        }),
    ]
    build_action_nla(arm_obj, "Chop_Mine", 24, chop_keys)

    # 5. Craft (1..32, focused tinkering/hammering in front of torso)
    craft_keys = [
        (1, {
            "Hips": {"loc": (0, 0, -0.025), "rot": (8, 0, 0)},
            "Spine": {"rot": (14, 0, 0)},
            "Head": {"rot": (12, 0, -4)},
            "UpperArm.L": {"rot": (42, 0, -34)}, "LowerArm.L": {"rot": (48, 0, 20)},
            "UpperArm.R": {"rot": (54, 0, 34)}, "LowerArm.R": {"rot": (58, 0, -20)},
            "Tail.01": {"rot": (4, 0, -12)}, "Tail.02": {"rot": (8, 0, -10)},
        }),
        (8, {
            "Hips": {"loc": (0, 0, -0.032), "rot": (10, 0, 2)},
            "Spine": {"rot": (16, 0, -2)},
            "Head": {"rot": (16, 0, 4)},
            "UpperArm.L": {"rot": (56, 0, -32)}, "LowerArm.L": {"rot": (62, 0, 22)},
            "UpperArm.R": {"rot": (34, 0, 32)}, "LowerArm.R": {"rot": (42, 0, -22)},
            "Tail.01": {"rot": (6, 0, 6)}, "Tail.02": {"rot": (10, 0, 12)},
        }),
        (16, {
            "Hips": {"loc": (0, 0, -0.020), "rot": (8, 0, -2)},
            "Spine": {"rot": (14, 0, 2)},
            "Head": {"rot": (10, 0, -5)},
            "UpperArm.L": {"rot": (36, 0, -34)}, "LowerArm.L": {"rot": (44, 0, 20)},
            "UpperArm.R": {"rot": (62, 0, 34)}, "LowerArm.R": {"rot": (66, 0, -20)},
            "Tail.01": {"rot": (4, 0, 14)}, "Tail.02": {"rot": (8, 0, 10)},
        }),
        (24, {
            "Hips": {"loc": (0, 0, -0.032), "rot": (10, 0, 2)},
            "Spine": {"rot": (16, 0, -2)},
            "Head": {"rot": (15, 0, 5)},
            "UpperArm.L": {"rot": (58, 0, -32)}, "LowerArm.L": {"rot": (64, 0, 22)},
            "UpperArm.R": {"rot": (36, 0, 32)}, "LowerArm.R": {"rot": (44, 0, -22)},
            "Tail.01": {"rot": (6, 0, -4)}, "Tail.02": {"rot": (10, 0, -10)},
        }),
        (32, {
            "Hips": {"loc": (0, 0, -0.025), "rot": (8, 0, 0)},
            "Spine": {"rot": (14, 0, 0)},
            "Head": {"rot": (12, 0, -4)},
            "UpperArm.L": {"rot": (42, 0, -34)}, "LowerArm.L": {"rot": (48, 0, 20)},
            "UpperArm.R": {"rot": (54, 0, 34)}, "LowerArm.R": {"rot": (58, 0, -20)},
            "Tail.01": {"rot": (4, 0, -12)}, "Tail.02": {"rot": (8, 0, -10)},
        }),
    ]
    build_action_nla(arm_obj, "Craft", 32, craft_keys)

    # 6. Sneak_Crouch (1..28, low stealthy crouch-walk & glancing around)
    sneak_keys = [
        (1, {
            "Hips": {"loc": (0, 0, -0.11), "rot": (18, 0, 4)},
            "Spine": {"rot": (20, 0, -3)},
            "Chest": {"rot": (10, 0, 0)},
            "Head": {"rot": (-24, 0, 14)},
            "UpperLeg.L": {"rot": (-28, 0, 0)}, "Boot.L": {"rot": (24, 0, 0)},
            "UpperLeg.R": {"rot": (-42, 0, 0)}, "Boot.R": {"rot": (36, 0, 0)},
            "UpperArm.L": {"rot": (24, 0, -16)}, "LowerArm.L": {"rot": (46, 0, 12)},
            "UpperArm.R": {"rot": (14, 0, 16)}, "LowerArm.R": {"rot": (46, 0, -12)},
            "Tail.01": {"rot": (-26, 0, 6)}, "Tail.02": {"rot": (-16, 0, 6)},
        }),
        (14, {
            "Hips": {"loc": (0, 0, -0.10), "rot": (18, 0, -4)},
            "Spine": {"rot": (20, 0, 3)},
            "Chest": {"rot": (10, 0, 0)},
            "Head": {"rot": (-24, 0, -14)},
            "UpperLeg.L": {"rot": (-42, 0, 0)}, "Boot.L": {"rot": (36, 0, 0)},
            "UpperLeg.R": {"rot": (-28, 0, 0)}, "Boot.R": {"rot": (24, 0, 0)},
            "UpperArm.L": {"rot": (14, 0, -16)}, "LowerArm.L": {"rot": (46, 0, 12)},
            "UpperArm.R": {"rot": (24, 0, 16)}, "LowerArm.R": {"rot": (46, 0, -12)},
            "Tail.01": {"rot": (-26, 0, -6)}, "Tail.02": {"rot": (-16, 0, -6)},
        }),
        (28, {
            "Hips": {"loc": (0, 0, -0.11), "rot": (18, 0, 4)},
            "Spine": {"rot": (20, 0, -3)},
            "Chest": {"rot": (10, 0, 0)},
            "Head": {"rot": (-24, 0, 14)},
            "UpperLeg.L": {"rot": (-28, 0, 0)}, "Boot.L": {"rot": (24, 0, 0)},
            "UpperLeg.R": {"rot": (-42, 0, 0)}, "Boot.R": {"rot": (36, 0, 0)},
            "UpperArm.L": {"rot": (24, 0, -16)}, "LowerArm.L": {"rot": (46, 0, 12)},
            "UpperArm.R": {"rot": (14, 0, 16)}, "LowerArm.R": {"rot": (46, 0, -12)},
            "Tail.01": {"rot": (-26, 0, 6)}, "Tail.02": {"rot": (-16, 0, 6)},
        }),
    ]
    build_action_nla(arm_obj, "Sneak_Crouch", 28, sneak_keys)

    # 7. Take_Damage (1..18, sharp knockback flinch & recovery)
    dmg_keys = [
        (1, {
            "Hips": {"loc": (0, 0, 0.0), "rot": (0, 0, 0)},
            "Spine": {"rot": (0, 0, 0)},
            "Head": {"rot": (0, 0, 0)},
            "Tufts": {"rot": (0, 0, 0)},
            "UpperArm.L": {"rot": (0, 0, 0)}, "LowerArm.L": {"rot": (6, 0, 0)},
            "UpperArm.R": {"rot": (0, 0, 0)}, "LowerArm.R": {"rot": (6, 0, 0)},
            "Tail.01": {"rot": (0, 0, 0)},
        }),
        (5, {
            "Hips": {"loc": (0, 0.085, -0.025), "rot": (-24, 0, 8)},
            "Spine": {"rot": (-22, 0, 6)},
            "Head": {"rot": (-26, 0, -10)},
            "Tufts": {"rot": (-25, 0, 0)},
            "UpperArm.L": {"rot": (48, 0, 46)}, "LowerArm.L": {"rot": (16, 0, 0)},
            "UpperArm.R": {"rot": (48, 0, -46)}, "LowerArm.R": {"rot": (16, 0, 0)},
            "Tail.01": {"rot": (28, 0, 18)},
        }),
        (11, {
            "Hips": {"loc": (0, 0.045, -0.045), "rot": (-10, 0, -4)},
            "Spine": {"rot": (8, 0, -3)},
            "Head": {"rot": (10, 0, 4)},
            "Tufts": {"rot": (12, 0, 0)},
            "UpperArm.L": {"rot": (16, 0, 14)}, "LowerArm.L": {"rot": (14, 0, 0)},
            "UpperArm.R": {"rot": (16, 0, -14)}, "LowerArm.R": {"rot": (14, 0, 0)},
            "Tail.01": {"rot": (-10, 0, -8)},
        }),
        (18, {
            "Hips": {"loc": (0, 0, 0.0), "rot": (0, 0, 0)},
            "Spine": {"rot": (0, 0, 0)},
            "Head": {"rot": (0, 0, 0)},
            "Tufts": {"rot": (0, 0, 0)},
            "UpperArm.L": {"rot": (0, 0, 0)}, "LowerArm.L": {"rot": (6, 0, 0)},
            "UpperArm.R": {"rot": (0, 0, 0)}, "LowerArm.R": {"rot": (6, 0, 0)},
            "Tail.01": {"rot": (0, 0, 0)},
        }),
    ]
    build_action_nla(arm_obj, "Take_Damage", 18, dmg_keys)

    # 8. Death (1..30, dramatic faint & collapse onto ground)
    death_keys = [
        (1, {
            "Hips": {"loc": (0, 0, 0.0), "rot": (0, 0, 0)},
            "Spine": {"rot": (0, 0, 0)},
            "Head": {"rot": (0, 0, 0)},
            "UpperLeg.L": {"rot": (0, 0, 0)}, "Boot.L": {"rot": (0, 0, 0)},
            "UpperLeg.R": {"rot": (0, 0, 0)}, "Boot.R": {"rot": (0, 0, 0)},
            "UpperArm.L": {"rot": (0, 0, 0)}, "LowerArm.L": {"rot": (6, 0, 0)},
            "UpperArm.R": {"rot": (0, 0, 0)}, "LowerArm.R": {"rot": (6, 0, 0)},
            "Tail.01": {"rot": (0, 0, 0)}, "Tail.02": {"rot": (0, 0, 0)},
        }),
        (8, {
            "Hips": {"loc": (0, 0.06, -0.03), "rot": (-22, 0, 12)},
            "Spine": {"rot": (-18, 0, 8)},
            "Head": {"rot": (-24, 0, -16)},
            "UpperLeg.L": {"rot": (12, 0, 0)}, "Boot.L": {"rot": (-12, 0, 0)},
            "UpperLeg.R": {"rot": (-10, 0, 0)}, "Boot.R": {"rot": (10, 0, 0)},
            "UpperArm.L": {"rot": (52, 0, 38)}, "LowerArm.L": {"rot": (18, 0, 0)},
            "UpperArm.R": {"rot": (44, 0, -42)}, "LowerArm.R": {"rot": (18, 0, 0)},
            "Tail.01": {"rot": (18, 0, 14)}, "Tail.02": {"rot": (12, 0, 10)},
        }),
        (20, {
            "Hips": {"loc": (0, 0.22, -0.25), "rot": (-82, 0, 10)},
            "Spine": {"rot": (-6, 0, 4)},
            "Head": {"rot": (-12, 0, -12)},
            "UpperLeg.L": {"rot": (14, 0, 14)}, "Boot.L": {"rot": (-8, 0, 0)},
            "UpperLeg.R": {"rot": (8, 0, -14)}, "Boot.R": {"rot": (-6, 0, 0)},
            "UpperArm.L": {"rot": (16, 0, 56)}, "LowerArm.L": {"rot": (10, 0, 0)},
            "UpperArm.R": {"rot": (12, 0, -56)}, "LowerArm.R": {"rot": (10, 0, 0)},
            "Tail.01": {"rot": (-28, 0, 12)}, "Tail.02": {"rot": (-16, 0, 8)},
        }),
        (30, {
            "Hips": {"loc": (0, 0.24, -0.27), "rot": (-88, 0, 10)},
            "Spine": {"rot": (0, 0, 4)},
            "Head": {"rot": (-4, 0, -18)},
            "UpperLeg.L": {"rot": (18, 0, 18)}, "Boot.L": {"rot": (-10, 0, 0)},
            "UpperLeg.R": {"rot": (12, 0, -18)}, "Boot.R": {"rot": (-8, 0, 0)},
            "UpperArm.L": {"rot": (6, 0, 66)}, "LowerArm.L": {"rot": (6, 0, 0)},
            "UpperArm.R": {"rot": (4, 0, -64)}, "LowerArm.R": {"rot": (6, 0, 0)},
            "Tail.01": {"rot": (-36, 0, 18)}, "Tail.02": {"rot": (-20, 0, 14)},
        }),
    ]
    build_action_nla(arm_obj, "Death", 30, death_keys)

    bpy.ops.object.mode_set(mode='OBJECT')


# ---------------------------------------------------------------------------
# Main Build & Export
# ---------------------------------------------------------------------------

def count_triangles(objs):
    total = 0
    for obj in objs:
        if obj.type == 'MESH':
            mesh = obj.data
            mesh.calc_loop_triangles()
            total += len(mesh.loop_triangles)
    return total


def main():
    clear_scene()
    mats = create_materials()

    # Build character parts
    head_outline, head_details = build_head_and_face(mats)
    torso_outline, torso_details = build_torso_and_belly(mats)
    arm_outline = build_arms_and_hands(mats)
    leg_outline = build_legs_and_boots(mats)
    tail_outline = build_tail(mats)

    # Join silhouette parts and apply inverted-hull black outline
    body_obj = join_objects(
        head_outline + torso_outline + arm_outline + leg_outline + tail_outline,
        "Tarcy_Body"
    )
    apply_inverted_hull_outline(body_obj, mats["outline"], thickness=0.0125)
    uv_unwrap_object(body_obj)

    # Join facial & belly details (no outline solidify so features stay crisp)
    details_obj = join_objects(head_details + torso_details, "Tarcy_Details")
    uv_unwrap_object(details_obj)

    # Build Armature, bind meshes, author all 8 NLA animations
    arm_obj = build_armature()
    bind_mesh_to_armature(body_obj, arm_obj)
    bind_mesh_to_armature(details_obj, arm_obj)
    build_all_animations(arm_obj)

    # Stats check
    tri_count = count_triangles([body_obj, details_obj])
    nla_names = [t.name for t in arm_obj.animation_data.nla_tracks]
    print(f"[build_tarcy] Mesh triangles: {tri_count}")
    print(f"[build_tarcy] NLA clips ({len(nla_names)}): {nla_names}")

    # Export GLB
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(repo_root, "public", "models")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "tarcy_boots.glb")

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        export_yup=True,
        export_apply=False,
        export_materials='EXPORT',
        export_skins=True,
        export_animations=True,
        export_animation_mode='NLA_TRACKS',
        export_nla_strips=True,
        export_anim_slide_to_zero=True,
    )
    size_kb = os.path.getsize(out_path) / 1024.0
    print(f"[build_tarcy] Exported {out_path} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
