"""
EXOTIC-003: Companion 3D Models, Rigs & Animations — Dos & Crockstar
Generates:
  - public/models/dos.glb (~3,200 tris)
  - public/models/crockstar.glb (~6,500 tris)

Run headless with:
  blender --background --python blender_scripts/build_companions.py
"""

import math
import os
import bpy
import bmesh
from mathutils import Vector, Matrix, Euler


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "public", "models")


# ---------------------------------------------------------------------------
# Shared Scene, Material, Geometry & Rigging Utilities
# ---------------------------------------------------------------------------

def reset_scene():
    """Reset Blender to a completely clean empty scene."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 30
    scene.frame_start = 1
    scene.frame_end = 60


def srgb_to_linear(c):
    """Convert an sRGB channel [0..1] to linear space for Blender materials."""
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def make_cel_material(name, hex_rgb, roughness=0.85, specular=0.12, metallic=0.0, backface_cull=False):
    """Create a crisp cel/toon-ready glTF Principled BSDF material."""
    mat = bpy.data.materials.new(name=name)
    mat.use_backface_culling = backface_cull

    r = ((hex_rgb >> 16) & 0xFF) / 255.0
    g = ((hex_rgb >> 8) & 0xFF) / 255.0
    b = (hex_rgb & 0xFF) / 255.0
    lin = (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)

    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = lin
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = specular
    mat.diffuse_color = lin
    return mat


def make_outline_material(name="Mat_Outline_Black"):
    """Create matte black inverted-hull outline material with backface culling (doubleSided: false in glTF)."""
    mat = bpy.data.materials.new(name=name)
    mat.use_backface_culling = True

    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.008, 0.008, 0.010, 1.0)
        bsdf.inputs["Roughness"].default_value = 1.0
        bsdf.inputs["Metallic"].default_value = 0.0
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = 0.0
    mat.diffuse_color = (0.01, 0.01, 0.012, 1.0)
    return mat


def create_mesh_object(name, bm, mat, smooth=True):
    """Convert a bmesh into a linked Blender Object with consistent outward normals, material, and UVs."""
    mesh = bpy.data.meshes.new(name)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    if isinstance(mat, list):
        for m in mat:
            obj.data.materials.append(m)
    elif mat is not None:
        obj.data.materials.append(mat)

    if smooth:
        for poly in mesh.polygons:
            poly.use_smooth = True

    # Generate simple box-projected UVs so glTF always has valid TEXCOORD_0
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        n = poly.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for li in poly.loop_indices:
            v = mesh.vertices[mesh.loops[li].vertex_index].co
            if az >= ax and az >= ay:
                uv_layer.data[li].uv = (v.x * 0.5 + 0.5, v.y * 0.5 + 0.5)
            elif ax >= ay:
                uv_layer.data[li].uv = (v.y * 0.5 + 0.5, v.z * 0.5 + 0.5)
            else:
                uv_layer.data[li].uv = (v.x * 0.5 + 0.5, v.z * 0.5 + 0.5)

    return obj


def assign_rigid_weight(obj, bone_name):
    """Assign 100% weight of all vertices in obj to a single bone."""
    vg = obj.vertex_groups.get(bone_name) or obj.vertex_groups.new(name=bone_name)
    indices = [v.index for v in obj.data.vertices]
    if indices:
        vg.add(indices, 1.0, 'REPLACE')


def assign_gradient_weights(obj, axis, stops):
    """
    Assign smooth blended weights along an axis ('x', 'y', or 'z').
    stops: list of (coord, bone_name) sorted ascending by coord.
    """
    vgs = {}
    for _, bname in stops:
        if bname not in vgs:
            vgs[bname] = obj.vertex_groups.get(bname) or obj.vertex_groups.new(name=bname)

    for v in obj.data.vertices:
        val = getattr(v.co, axis)
        if val <= stops[0][0]:
            vgs[stops[0][1]].add([v.index], 1.0, 'REPLACE')
        elif val >= stops[-1][0]:
            vgs[stops[-1][1]].add([v.index], 1.0, 'REPLACE')
        else:
            for i in range(len(stops) - 1):
                c0, b0 = stops[i]
                c1, b1 = stops[i + 1]
                if c0 <= val <= c1:
                    t = (val - c0) / max(c1 - c0, 1e-6)
                    # Smoothstep for organic bending
                    t = t * t * (3.0 - 2.0 * t)
                    if b0 == b1:
                        vgs[b0].add([v.index], 1.0, 'REPLACE')
                    else:
                        if 1.0 - t > 1e-4:
                            vgs[b0].add([v.index], 1.0 - t, 'ADD')
                        if t > 1e-4:
                            vgs[b1].add([v.index], t, 'ADD')
                    break


def apply_inverted_hull_outline(obj, outline_mat, thickness=0.016):
    """
    Add a Solidify modifier with flipped normals and outline material, then apply it
    so vertex groups are inherited by the outline hull and glTF exports clean skinning.
    """
    obj.data.materials.append(outline_mat)
    outline_slot = len(obj.data.materials) - 1

    mod = obj.modifiers.new(name="Outline_Solidify", type='SOLIDIFY')
    mod.thickness = thickness
    mod.offset = 1.0  # Extrude outward along normals
    mod.use_flip_normals = True
    mod.use_rim = False
    mod.use_even_offset = False
    mod.thickness_clamp = 0.5
    mod.material_offset = outline_slot

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)


def bind_to_armature(objs, arm_obj):
    """Parent all mesh objects to the armature and add an Armature modifier."""
    for obj in objs:
        obj.parent = arm_obj
        mod = obj.modifiers.new(name="Armature", type='ARMATURE')
        mod.object = arm_obj


def add_uv_sphere_bm(bm, center, radii, segs=14, rings=9):
    """Add a scaled UV sphere to bmesh."""
    mat = Matrix.Translation(Vector(center)) @ Matrix.Diagonal((radii[0], radii[1], radii[2], 1.0))
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0, matrix=mat)


def add_capsule_bm(bm, p0, p1, r0, r1, segs=10, rings=5, cap_rings=2):
    """Create a tapered rounded capsule between p0 and p1 in bmesh."""
    p0 = Vector(p0)
    p1 = Vector(p1)
    axis = p1 - p0
    length = axis.length
    if length < 1e-6:
        return
    z_dir = axis.normalized()
    up = Vector((0, 0, 1)) if abs(z_dir.z) < 0.95 else Vector((1, 0, 0))
    x_dir = up.cross(z_dir).normalized()
    y_dir = z_dir.cross(x_dir).normalized()

    ring_verts = []

    # Bottom hemisphere cap
    bot_pole = bm.verts.new(p0 - z_dir * r0)
    for ci in range(1, cap_rings + 1):
        ang = -math.pi * 0.5 + (math.pi * 0.5) * (ci / (cap_rings + 1))
        rad = r0 * math.cos(ang)
        z_off = r0 * math.sin(ang)
        ring = []
        for s in range(segs):
            theta = 2.0 * math.pi * s / segs
            pt = p0 + z_dir * z_off + (x_dir * math.cos(theta) + y_dir * math.sin(theta)) * rad
            ring.append(bm.verts.new(pt))
        ring_verts.append(ring)

    # Shaft rings
    for ri in range(rings + 1):
        t = ri / rings
        c = p0.lerp(p1, t)
        rad = r0 * (1.0 - t) + r1 * t
        ring = []
        for s in range(segs):
            theta = 2.0 * math.pi * s / segs
            pt = c + (x_dir * math.cos(theta) + y_dir * math.sin(theta)) * rad
            ring.append(bm.verts.new(pt))
        ring_verts.append(ring)

    # Top hemisphere cap
    for ci in range(1, cap_rings + 1):
        ang = (math.pi * 0.5) * (ci / (cap_rings + 1))
        rad = r1 * math.cos(ang)
        z_off = r1 * math.sin(ang)
        ring = []
        for s in range(segs):
            theta = 2.0 * math.pi * s / segs
            pt = p1 + z_dir * z_off + (x_dir * math.cos(theta) + y_dir * math.sin(theta)) * rad
            ring.append(bm.verts.new(pt))
        ring_verts.append(ring)

    top_pole = bm.verts.new(p1 + z_dir * r1)

    # Connect bottom cap
    first = ring_verts[0]
    for s in range(segs):
        s_next = (s + 1) % segs
        bm.faces.new((bot_pole, first[s_next], first[s]))

    # Connect rings
    for r_idx in range(len(ring_verts) - 1):
        r_a = ring_verts[r_idx]
        r_b = ring_verts[r_idx + 1]
        for s in range(segs):
            s_next = (s + 1) % segs
            bm.faces.new((r_a[s], r_a[s_next], r_b[s_next], r_b[s]))

    # Connect top cap
    last = ring_verts[-1]
    for s in range(segs):
        s_next = (s + 1) % segs
        bm.faces.new((last[s], last[s_next], top_pole))


def add_cone_bm(bm, base_center, tip, radius, segs=6):
    """Create a closed conical tooth or claw pointing from base_center to tip."""
    base_center = Vector(base_center)
    tip = Vector(tip)
    axis = tip - base_center
    if axis.length < 1e-6:
        return
    z_dir = axis.normalized()
    up = Vector((0, 0, 1)) if abs(z_dir.z) < 0.95 else Vector((1, 0, 0))
    x_dir = up.cross(z_dir).normalized()
    y_dir = z_dir.cross(x_dir).normalized()

    base_ring = []
    for s in range(segs):
        theta = 2.0 * math.pi * s / segs
        pt = base_center + (x_dir * math.cos(theta) + y_dir * math.sin(theta)) * radius
        base_ring.append(bm.verts.new(pt))
    tip_v = bm.verts.new(tip)

    for s in range(segs):
        s_next = (s + 1) % segs
        bm.faces.new((base_ring[s], base_ring[s_next], tip_v))
    bm.faces.new(list(reversed(base_ring)))


def add_box_bm(bm, center, size, rot_euler=(0, 0, 0)):
    """Create an oriented box in bmesh."""
    mat = (
        Matrix.Translation(Vector(center))
        @ Euler(rot_euler, 'XYZ').to_matrix().to_4x4()
        @ Matrix.Diagonal((size[0], size[1], size[2], 1.0))
    )
    bmesh.ops.create_cube(bm, size=1.0, matrix=mat)


def add_lofted_tube_bm(bm, rings_spec, segs=12, cap_start=True, cap_end=True, mat_fn=None):
    """
    Create a lofted mesh from a list of (center_vec, rx, ry, pitch_rad) or
    custom ring point lists. Here rings_spec is list of dicts:
      {'center': (x,y,z), 'rx': float, 'ry': float, 'rz': float, 'tilt_x': float}
    """
    all_rings = []
    for spec in rings_spec:
        c = Vector(spec['center'])
        rx = spec['rx']
        ry = spec['ry']
        tilt_x = spec.get('tilt_x', 0.0)
        rot = Matrix.Rotation(tilt_x, 3, 'X')
        ring = []
        for s in range(segs):
            theta = 2.0 * math.pi * s / segs
            # Local XY cross-section rotated by tilt_x
            local = Vector((math.cos(theta) * rx, math.sin(theta) * ry, 0.0))
            pt = c + (rot @ local)
            ring.append(bm.verts.new(pt))
        all_rings.append(ring)

    for r_idx in range(len(all_rings) - 1):
        r_a = all_rings[r_idx]
        r_b = all_rings[r_idx + 1]
        for s in range(segs):
            s_next = (s + 1) % segs
            f = bm.faces.new((r_a[s], r_a[s_next], r_b[s_next], r_b[s]))
            if mat_fn:
                f.material_index = mat_fn(r_idx, s, segs, f)

    if cap_start and all_rings:
        f = bm.faces.new(list(reversed(all_rings[0])))
        if mat_fn:
            f.material_index = mat_fn(0, 0, segs, f)
    if cap_end and all_rings:
        f = bm.faces.new(all_rings[-1])
        if mat_fn:
            f.material_index = mat_fn(len(all_rings) - 1, 0, segs, f)


def reset_pose(arm_obj):
    """Reset all pose bones to identity transform and XYZ Euler mode."""
    for pb in arm_obj.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.location = (0.0, 0.0, 0.0)
        pb.rotation_euler = (0.0, 0.0, 0.0)
        pb.scale = (1.0, 1.0, 1.0)


def key_bone(arm_obj, bone_name, frame, loc=None, rot_deg=None, scale=None):
    """Set and keyframe a pose bone's location, rotation (degrees), and/or scale."""
    pb = arm_obj.pose.bones[bone_name]
    pb.rotation_mode = 'XYZ'
    if loc is not None:
        pb.location = loc
        pb.keyframe_insert(data_path="location", frame=frame)
    if rot_deg is not None:
        pb.rotation_euler = tuple(math.radians(a) for a in rot_deg)
        pb.keyframe_insert(data_path="rotation_euler", frame=frame)
    if scale is not None:
        pb.scale = scale
        pb.keyframe_insert(data_path="scale", frame=frame)


def build_nla_action(arm_obj, name, keyframe_fn):
    """Create a named Action, populate keyframes via keyframe_fn, and push to an NLA track."""
    if not arm_obj.animation_data:
        arm_obj.animation_data_create()

    reset_pose(arm_obj)
    act = bpy.data.actions.new(name=name)
    arm_obj.animation_data.action = act

    keyframe_fn(arm_obj)

    track = arm_obj.animation_data.nla_tracks.new()
    track.name = name
    track.mute = False
    strip = track.strips.new(name, 1, act)
    strip.name = name
    arm_obj.animation_data.action = None
    reset_pose(arm_obj)


def export_glb(filepath):
    """Export current scene to GLB with NLA animations and skinning intact."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format='GLB',
        export_apply=False,
        export_animations=True,
        export_animation_mode='NLA_TRACKS',
        export_nla_strips=True,
        export_anim_slide_to_zero=True,
        export_materials='EXPORT',
        export_yup=True,
    )


def count_scene_tris():
    """Return total triangle count across all mesh objects in the scene."""
    total = 0
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            for p in obj.data.polygons:
                total += len(p.vertices) - 2
    return total


# ---------------------------------------------------------------------------
# CHARACTER 1: DOS (Double-Agent Companion, ~3,200 tris)
# ---------------------------------------------------------------------------

def build_dos_fbi_letters(mat_gold):
    """
    Build crisp 3D extruded block letters 'F', 'B', 'I' curved slightly along
    the front of Dos's black FBI baseball cap crown.
    """
    bm = bmesh.new()

    def add_stroke(x0, z0, x1, z1, thick=0.015, depth=0.014):
        """Add a rectangular letter stroke projected onto the cap front arc."""
        cx = (x0 + x1) * 0.5
        cz = (z0 + z1) * 0.5
        w = abs(x1 - x0)
        h = abs(z1 - z0)
        if w < thick:
            w = thick
        if h < thick:
            h = thick
        # Project onto cap cylinder surface around Y = -0.195, Z = 0.65
        radius_xy = 0.196
        ang = cx / radius_xy
        px = math.sin(ang) * radius_xy
        py = -math.cos(ang) * radius_xy - 0.004
        # Slight upward taper of cap crown
        z_taper = (cz - 0.58) * 0.14
        py += z_taper
        rot = (math.radians(-10.0), 0.0, ang)
        add_box_bm(bm, (px, py, cz), (w, depth, h), rot_euler=rot)

    z_bot = 0.640
    z_mid = 0.687
    z_top = 0.733
    t = 0.015

    # Letter 'F' (left, X from -0.095 to -0.045)
    add_stroke(-0.092, z_bot, -0.077, z_top, t)  # vertical stem
    add_stroke(-0.092, z_top - t, -0.045, z_top, t)  # top bar
    add_stroke(-0.092, z_mid - t * 0.5, -0.055, z_mid + t * 0.5, t)  # mid bar

    # Letter 'B' (center, X from -0.028 to +0.028)
    add_stroke(-0.026, z_bot, -0.011, z_top, t)  # vertical stem
    add_stroke(-0.026, z_top - t, 0.020, z_top, t)  # top bar
    add_stroke(-0.026, z_mid - t * 0.5, 0.022, z_mid + t * 0.5, t)  # mid bar
    add_stroke(-0.026, z_bot, 0.022, z_bot + t, t)  # bottom bar
    add_stroke(0.010, z_mid, 0.025, z_top - t * 0.3, t)  # upper right bowl
    add_stroke(0.012, z_bot + t * 0.3, 0.027, z_mid, t)  # lower right bowl

    # Letter 'I' (right, X from +0.052 to +0.088)
    add_stroke(0.062, z_bot, 0.077, z_top, t)  # center stem
    add_stroke(0.050, z_top - t * 0.85, 0.089, z_top, t * 0.85)  # top serif
    add_stroke(0.050, z_bot, 0.089, z_bot + t * 0.85, t * 0.85)  # bottom serif

    obj = create_mesh_object("Dos_FBI_Text", bm, mat_gold, smooth=False)
    return obj


def build_dos_cap(mat_cap, mat_outline):
    """Build Dos's fitted black FBI baseball cap (crown + curved visor brim + top button)."""
    bm = bmesh.new()

    # Cap crown dome (Z = 0.570 to 0.810)
    segs = 14
    rings = [
        (0.570, 0.205, 0.212, 0.005),
        (0.615, 0.206, 0.214, 0.005),
        (0.670, 0.196, 0.204, 0.008),
        (0.725, 0.172, 0.178, 0.010),
        (0.773, 0.125, 0.130, 0.012),
        (0.803, 0.060, 0.062, 0.012),
    ]
    crown_rings = []
    for z, rx, ry, y_off in rings:
        ring = []
        for s in range(segs):
            th = 2.0 * math.pi * s / segs
            ring.append(bm.verts.new((math.cos(th) * rx, math.sin(th) * ry + y_off, z)))
        crown_rings.append(ring)

    top_pole = bm.verts.new((0.0, 0.012, 0.813))
    bot_pole = bm.verts.new((0.0, 0.005, 0.570))

    for ri in range(len(crown_rings) - 1):
        ra, rb = crown_rings[ri], crown_rings[ri + 1]
        for s in range(segs):
            sn = (s + 1) % segs
            bm.faces.new((ra[s], ra[sn], rb[sn], rb[s]))

    for s in range(segs):
        sn = (s + 1) % segs
        bm.faces.new((crown_rings[-1][s], crown_rings[-1][sn], top_pole))
        bm.faces.new((bot_pole, crown_rings[0][sn], crown_rings[0][s]))

    # Curved visor brim extending forward (-Y) from front rim of crown
    brim_segs = 10
    arc_start = math.radians(-68.0)
    arc_end = math.radians(68.0)
    inner_top, outer_top = [], []
    inner_bot, outer_bot = [], []

    for i in range(brim_segs + 1):
        t = i / brim_segs
        ang = arc_start + (arc_end - arc_start) * t
        # Center of brim projects forward most; sides taper back into crown
        center_factor = math.cos(ang * 1.15)
        r_in = 0.195
        r_out = 0.195 + 0.155 * max(center_factor, 0.08)
        # Subtle curved bill arch (higher in middle, curving slightly down at tip)
        z_in = 0.587
        z_out = 0.563 + 0.012 * (1.0 - abs(2.0 * t - 1.0))
        thick = 0.018

        ix, iy = math.sin(ang) * r_in, -math.cos(ang) * r_in
        ox, oy = math.sin(ang) * r_out, -math.cos(ang) * r_out

        inner_top.append(bm.verts.new((ix, iy, z_in + thick * 0.5)))
        outer_top.append(bm.verts.new((ox, oy, z_out + thick * 0.4)))
        inner_bot.append(bm.verts.new((ix, iy, z_in - thick * 0.5)))
        outer_bot.append(bm.verts.new((ox, oy, z_out - thick * 0.4)))

    for i in range(brim_segs):
        bm.faces.new((inner_top[i], outer_top[i], outer_top[i + 1], inner_top[i + 1]))
        bm.faces.new((inner_bot[i + 1], outer_bot[i + 1], outer_bot[i], inner_bot[i]))
        bm.faces.new((outer_top[i], outer_bot[i], outer_bot[i + 1], outer_top[i + 1]))
        bm.faces.new((inner_bot[i], inner_top[i], inner_top[i + 1], inner_bot[i + 1]))

    # Cap ends of brim
    bm.faces.new((inner_top[0], inner_bot[0], outer_bot[0], outer_top[0]))
    bm.faces.new((inner_bot[-1], inner_top[-1], outer_top[-1], outer_bot[-1]))

    cap_obj = create_mesh_object("Dos_Cap", bm, mat_cap, smooth=True)
    assign_rigid_weight(cap_obj, "Head_Cap")
    apply_inverted_hull_outline(cap_obj, mat_outline, thickness=0.014)

    # Small cap top button (no outline needed)
    bm_btn = bmesh.new()
    add_uv_sphere_bm(bm_btn, (0.0, 0.012, 0.819), (0.022, 0.022, 0.014), segs=8, rings=5)
    btn_obj = create_mesh_object("Dos_Cap_Button", bm_btn, mat_cap, smooth=True)
    assign_rigid_weight(btn_obj, "Head_Cap")

    return cap_obj, btn_obj


def build_dos():
    """Build, rig, animate, and export Dos -> public/models/dos.glb (~3,200 tris)."""
    reset_scene()

    # Materials matching references/characters_ref.png
    mat_red = make_cel_material("Dos_Crimson", 0xC91E24, roughness=0.82, specular=0.14)
    mat_white = make_cel_material("Dos_EyeWhite", 0xF8F8F8, roughness=0.45, specular=0.25)
    mat_pupil = make_cel_material("Dos_Pupil", 0x1A0E0E, roughness=0.12, specular=0.65)
    mat_mouth = make_cel_material("Dos_Mouth", 0x3A0A0C, roughness=0.90, specular=0.05)
    mat_cap = make_cel_material("Dos_CapBlack", 0x24262A, roughness=0.88, specular=0.10)
    mat_gold = make_cel_material("Dos_FBIGold", 0xE6C445, roughness=0.42, specular=0.35, metallic=0.20)
    mat_outline = make_outline_material("Dos_Outline_Black")

    # 1. Rounded crimson blob body (Z = 0.14 to 0.65)
    bm_body = bmesh.new()
    body_rings = [
        {'center': (0.0, 0.0, 0.145), 'rx': 0.145, 'ry': 0.135},
        {'center': (0.0, 0.0, 0.210), 'rx': 0.215, 'ry': 0.198},
        {'center': (0.0, 0.0, 0.300), 'rx': 0.232, 'ry': 0.212},
        {'center': (0.0, 0.0, 0.400), 'rx': 0.222, 'ry': 0.205},
        {'center': (0.0, 0.0, 0.500), 'rx': 0.205, 'ry': 0.195},
        {'center': (0.0, 0.0, 0.585), 'rx': 0.175, 'ry': 0.170},
        {'center': (0.0, 0.0, 0.640), 'rx': 0.115, 'ry': 0.112},
    ]
    add_lofted_tube_bm(bm_body, body_rings, segs=14, cap_start=True, cap_end=True)
    body_obj = create_mesh_object("Dos_Body", bm_body, mat_red, smooth=True)
    assign_rigid_weight(body_obj, "Body")
    apply_inverted_hull_outline(body_obj, mat_outline, thickness=0.015)

    # 2. Stubby legs (touching Z = 0.0)
    leg_objs = []
    for side, sx in (("L", 1.0), ("R", -1.0)):
        bm_leg = bmesh.new()
        add_capsule_bm(
            bm_leg,
            p0=(sx * 0.105, -0.01, 0.055),
            p1=(sx * 0.100, 0.0, 0.175),
            r0=0.055,
            r1=0.068,
            segs=10,
            rings=3,
            cap_rings=2,
        )
        leg_obj = create_mesh_object(f"Dos_Leg_{side}", bm_leg, mat_red, smooth=True)
        assign_rigid_weight(leg_obj, f"Leg_{side}")
        apply_inverted_hull_outline(leg_obj, mat_outline, thickness=0.013)
        leg_objs.append(leg_obj)

    # 3. Stubby arms sticking down-outward from sides
    arm_objs = []
    for side, sx in (("L", 1.0), ("R", -1.0)):
        bm_arm = bmesh.new()
        add_capsule_bm(
            bm_arm,
            p0=(sx * 0.205, -0.015, 0.355),
            p1=(sx * 0.295, -0.035, 0.235),
            r0=0.056,
            r1=0.044,
            segs=10,
            rings=3,
            cap_rings=2,
        )
        arm_obj = create_mesh_object(f"Dos_Arm_{side}", bm_arm, mat_red, smooth=True)
        assign_rigid_weight(arm_obj, f"Arm_{side}")
        apply_inverted_hull_outline(arm_obj, mat_outline, thickness=0.012)
        arm_objs.append(arm_obj)

    # 4. Oversized spherical white eyes + glossy black pupils + highlight dots + mouth
    eye_objs = []
    for side, sx in (("L", 1.0), ("R", -1.0)):
        bm_eye = bmesh.new()
        add_uv_sphere_bm(bm_eye, (sx * 0.088, -0.185, 0.440), (0.086, 0.066, 0.086), segs=12, rings=8)
        eye_obj = create_mesh_object(f"Dos_Eye_{side}", bm_eye, mat_white, smooth=True)
        assign_rigid_weight(eye_obj, "Body")
        apply_inverted_hull_outline(eye_obj, mat_outline, thickness=0.010)
        eye_objs.append(eye_obj)

        bm_pup = bmesh.new()
        add_uv_sphere_bm(bm_pup, (sx * 0.084, -0.238, 0.440), (0.044, 0.022, 0.044), segs=10, rings=6)
        pup_obj = create_mesh_object(f"Dos_Pupil_{side}", bm_pup, mat_pupil, smooth=True)
        assign_rigid_weight(pup_obj, "Body")
        eye_objs.append(pup_obj)

        bm_hi = bmesh.new()
        add_uv_sphere_bm(bm_hi, (sx * 0.084 - 0.015, -0.258, 0.458), (0.013, 0.008, 0.013), segs=6, rings=4)
        hi_obj = create_mesh_object(f"Dos_EyeHighlight_{side}", bm_hi, mat_white, smooth=True)
        assign_rigid_weight(hi_obj, "Body")
        eye_objs.append(hi_obj)

    # Small deadpan horizontal mouth line
    bm_mouth = bmesh.new()
    add_capsule_bm(bm_mouth, (-0.032, -0.215, 0.320), (0.032, -0.215, 0.320), 0.008, 0.008, segs=6, rings=1, cap_rings=1)
    mouth_obj = create_mesh_object("Dos_Mouth", bm_mouth, mat_mouth, smooth=True)
    assign_rigid_weight(mouth_obj, "Body")

    # 5. FBI Baseball Cap + Gold "FBI" lettering
    cap_obj, btn_obj = build_dos_cap(mat_cap, mat_outline)
    fbi_obj = build_dos_fbi_letters(mat_gold)
    assign_rigid_weight(fbi_obj, "Head_Cap")

    all_meshes = [body_obj, mouth_obj, cap_obj, btn_obj, fbi_obj] + leg_objs + arm_objs + eye_objs

    # 6. Armature
    arm_data = bpy.data.armatures.new("Dos_Armature")
    arm_obj = bpy.data.objects.new("Dos_Rig", arm_data)
    bpy.context.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')

    eb = arm_data.edit_bones
    b_root = eb.new("Root")
    b_root.head = (0.0, 0.0, 0.0)
    b_root.tail = (0.0, 0.0, 0.14)

    b_body = eb.new("Body")
    b_body.parent = b_root
    b_body.head = (0.0, 0.0, 0.15)
    b_body.tail = (0.0, 0.0, 0.56)

    b_cap = eb.new("Head_Cap")
    b_cap.parent = b_body
    b_cap.head = (0.0, 0.0, 0.56)
    b_cap.tail = (0.0, 0.0, 0.80)

    for side, sx in (("L", 1.0), ("R", -1.0)):
        ba = eb.new(f"Arm_{side}")
        ba.parent = b_body
        ba.head = (sx * 0.20, -0.015, 0.36)
        ba.tail = (sx * 0.30, -0.035, 0.23)

        bl = eb.new(f"Leg_{side}")
        bl.parent = b_root
        bl.head = (sx * 0.10, 0.0, 0.17)
        bl.tail = (sx * 0.10, -0.01, 0.0)

    bpy.ops.object.mode_set(mode='OBJECT')
    bind_to_armature(all_meshes, arm_obj)

    # 7. Animations -> NLA Tracks: Idle, Waddle, Alert_Signal, Hide_Assist_Aura, Follow
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='POSE')

    # --- Idle (40 frames) ---
    def anim_idle(arm):
        for f, z_bob, sx_s, sz_s, arm_r, cap_p in [
            (1, 0.0, 1.0, 1.0, 0.0, 0.0),
            (20, 0.018, 0.97, 1.04, 6.0, -3.0),
            (40, 0.0, 1.0, 1.0, 0.0, 0.0),
        ]:
            key_bone(arm, "Body", f, loc=(0, 0, z_bob), scale=(sx_s, sx_s, sz_s))
            key_bone(arm, "Head_Cap", f, rot_deg=(cap_p, 0, 0))
            key_bone(arm, "Arm_L", f, rot_deg=(0, arm_r, 0))
            key_bone(arm, "Arm_R", f, rot_deg=(0, -arm_r, 0))

    # --- Waddle (24 frames) ---
    def anim_waddle(arm):
        frames = [
            (1,  0.00,  0.0,   0.0,  0.0,   0.0,   0.0,  0.0),
            (6,  0.03, -9.0,  26.0, -18.0, -16.0,  16.0,  5.0),
            (12, 0.00,  0.0,   0.0,  0.0,   0.0,   0.0,  0.0),
            (18, 0.03,  9.0, -18.0,  26.0,  16.0, -16.0, -5.0),
            (24, 0.00,  0.0,   0.0,  0.0,   0.0,   0.0,  0.0),
        ]
        for f, zb, roll, leg_l, leg_r, arm_l, arm_r, cap_r in frames:
            key_bone(arm, "Body", f, loc=(0, 0, zb), rot_deg=(4.0, roll, 0))
            key_bone(arm, "Leg_L", f, rot_deg=(leg_l, 0, 0))
            key_bone(arm, "Leg_R", f, rot_deg=(leg_r, 0, 0))
            key_bone(arm, "Arm_L", f, rot_deg=(arm_l, 0, 0))
            key_bone(arm, "Arm_R", f, rot_deg=(arm_r, 0, 0))
            key_bone(arm, "Head_Cap", f, rot_deg=(-2.0, cap_r, 0))

    # --- Alert_Signal (30 frames): Startled jump + wave arms + cap pops slightly ---
    def anim_alert(arm):
        key_bone(arm, "Body", 1, loc=(0, 0, 0), rot_deg=(0, 0, 0), scale=(1, 1, 1))
        key_bone(arm, "Head_Cap", 1, loc=(0, 0, 0), rot_deg=(0, 0, 0))
        key_bone(arm, "Arm_L", 1, rot_deg=(0, 0, 0))
        key_bone(arm, "Arm_R", 1, rot_deg=(0, 0, 0))

        # Anticipation squash
        key_bone(arm, "Body", 5, loc=(0, 0, -0.03), scale=(1.08, 1.08, 0.88))
        # Hop up & wave!
        key_bone(arm, "Body", 11, loc=(0, 0, 0.14), rot_deg=(-6, 0, 10), scale=(0.94, 0.94, 1.10))
        key_bone(arm, "Head_Cap", 12, loc=(0, 0, 0.05), rot_deg=(-14, 0, 0))
        key_bone(arm, "Arm_L", 11, rot_deg=(-20, -65, 0))
        key_bone(arm, "Arm_R", 11, rot_deg=(-20, 65, 0))

        # Quick look & wave pulse
        key_bone(arm, "Body", 17, loc=(0, 0, 0.04), rot_deg=(0, 0, -14), scale=(1.02, 1.02, 0.96))
        key_bone(arm, "Head_Cap", 17, loc=(0, 0, 0.01), rot_deg=(-4, 0, -8))
        key_bone(arm, "Arm_L", 17, rot_deg=(10, -40, 0))
        key_bone(arm, "Arm_R", 17, rot_deg=(10, 40, 0))

        key_bone(arm, "Body", 23, loc=(0, 0, 0.07), rot_deg=(0, 0, 8), scale=(0.98, 0.98, 1.04))
        key_bone(arm, "Arm_L", 23, rot_deg=(-15, -62, 0))
        key_bone(arm, "Arm_R", 23, rot_deg=(-15, 62, 0))

        # Settle
        key_bone(arm, "Body", 30, loc=(0, 0, 0), rot_deg=(0, 0, 0), scale=(1, 1, 1))
        key_bone(arm, "Head_Cap", 30, loc=(0, 0, 0), rot_deg=(0, 0, 0))
        key_bone(arm, "Arm_L", 30, rot_deg=(0, 0, 0))
        key_bone(arm, "Arm_R", 30, rot_deg=(0, 0, 0))

    # --- Hide_Assist_Aura (40 frames): Undercover crouch, cap pulled low, arms pulsing stealth aura ---
    def anim_hide_assist(arm):
        for f, zb, cap_p, cap_z, arm_s, sc_z in [
            (1,  -0.06, 16.0, -0.025, 35.0, 0.88),
            (10, -0.08, 20.0, -0.032, 52.0, 0.84),
            (20, -0.05, 14.0, -0.020, 30.0, 0.91),
            (30, -0.08, 20.0, -0.032, 52.0, 0.84),
            (40, -0.06, 16.0, -0.025, 35.0, 0.88),
        ]:
            key_bone(arm, "Body", f, loc=(0, 0, zb), rot_deg=(8.0, 0, 0), scale=(1.08, 1.08, sc_z))
            key_bone(arm, "Head_Cap", f, loc=(0, 0, cap_z), rot_deg=(cap_p, 0, 0))
            key_bone(arm, "Arm_L", f, rot_deg=(12.0, -arm_s, 0))
            key_bone(arm, "Arm_R", f, rot_deg=(12.0, arm_s, 0))

    # --- Follow (18 frames): Energetic bouncy forward lean jog ---
    def anim_follow(arm):
        frames = [
            (1,  0.00,  0.0,  28.0, -24.0, -28.0,  28.0),
            (5,  0.05, -6.0,   0.0,   0.0,   0.0,   0.0),
            (9,  0.00,  0.0, -24.0,  28.0,  28.0, -28.0),
            (14, 0.05,  6.0,   0.0,   0.0,   0.0,   0.0),
            (18, 0.00,  0.0,  28.0, -24.0, -28.0,  28.0),
        ]
        for f, zb, roll, leg_l, leg_r, arm_l, arm_r in frames:
            key_bone(arm, "Body", f, loc=(0, 0, zb), rot_deg=(12.0, roll, 0))
            key_bone(arm, "Head_Cap", f, rot_deg=(-6.0, -roll * 0.5, 0))
            key_bone(arm, "Leg_L", f, rot_deg=(leg_l, 0, 0))
            key_bone(arm, "Leg_R", f, rot_deg=(leg_r, 0, 0))
            key_bone(arm, "Arm_L", f, rot_deg=(arm_l, -10.0, 0))
            key_bone(arm, "Arm_R", f, rot_deg=(arm_r, 10.0, 0))

    build_nla_action(arm_obj, "Idle", anim_idle)
    build_nla_action(arm_obj, "Waddle", anim_waddle)
    build_nla_action(arm_obj, "Alert_Signal", anim_alert)
    build_nla_action(arm_obj, "Hide_Assist_Aura", anim_hide_assist)
    build_nla_action(arm_obj, "Follow", anim_follow)

    bpy.ops.object.mode_set(mode='OBJECT')
    tris = count_scene_tris()
    out_path = os.path.join(OUTPUT_DIR, "dos.glb")
    export_glb(out_path)
    print(f"[EXOTIC-003] Exported {out_path} | Tris: {tris} | NLA tracks: {[t.name for t in arm_obj.animation_data.nla_tracks]}")


# ---------------------------------------------------------------------------
# CHARACTER 2: CROCKSTAR (Tameable Crocodile Companion, ~6,500 tris)
# ---------------------------------------------------------------------------

def build_crock_head_and_snout(mat_olive, mat_mouth, mat_outline):
    """Build Crockstar's cranium, rounded-boxy snout, nostril bumps, and raised eye brows."""
    bm = bmesh.new()

    # Lofted head + snout running along Y from back of skull (+0.17) to snout tip (-0.52)
    segs = 14
    profile = [
        # (y, z_center, rx, rz, flat_bottom_ratio)
        (0.175,  0.860, 0.145, 0.125, 0.25),
        (0.100,  0.875, 0.195, 0.150, 0.20),
        (0.000,  0.880, 0.205, 0.155, 0.18),
        (-0.100, 0.865, 0.195, 0.138, 0.22),
        (-0.190, 0.835, 0.175, 0.100, 0.35),
        (-0.290, 0.822, 0.158, 0.085, 0.40),
        (-0.390, 0.818, 0.142, 0.078, 0.42),
        (-0.465, 0.818, 0.126, 0.074, 0.42),
        (-0.515, 0.815, 0.090, 0.056, 0.45),
    ]

    rings = []
    for y, zc, rx, rz, flat_bot in profile:
        ring = []
        for s in range(segs):
            th = 2.0 * math.pi * s / segs
            cx = math.cos(th)
            sz = math.sin(th)
            # Slightly flatten the underside of the upper jaw so it meets the lower jaw cleanly
            if sz < 0.0:
                sz = sz * (1.0 - flat_bot)
            # Slightly square off the snout top corners for cartoon croc charm
            x = math.copysign(abs(cx) ** 0.85, cx) * rx
            z = zc + math.copysign(abs(sz) ** 0.88, sz) * rz
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)

    for ri in range(len(rings) - 1):
        ra, rb = rings[ri], rings[ri + 1]
        for s in range(segs):
            sn = (s + 1) % segs
            bm.faces.new((ra[s], rb[s], rb[sn], ra[sn]))

    # Cap back and snout tip
    back_pole = bm.verts.new((0.0, 0.205, 0.860))
    tip_pole = bm.verts.new((0.0, -0.538, 0.812))
    for s in range(segs):
        sn = (s + 1) % segs
        bm.faces.new((back_pole, rings[0][sn], rings[0][s]))
        bm.faces.new((rings[-1][s], rings[-1][sn], tip_pole))

    # Raised brow ridges / eye sockets on top-back of snout
    for sx in (1.0, -1.0):
        add_uv_sphere_bm(bm, (sx * 0.105, -0.095, 1.005), (0.076, 0.088, 0.068), segs=10, rings=7)
        # Nostril bumps near snout tip
        add_uv_sphere_bm(bm, (sx * 0.058, -0.445, 0.882), (0.032, 0.036, 0.024), segs=8, rings=5)

    head_obj = create_mesh_object("Crock_Head", bm, mat_olive, smooth=True)
    assign_rigid_weight(head_obj, "Head")
    apply_inverted_hull_outline(head_obj, mat_outline, thickness=0.017)

    # Dark nostril indentations (no outline)
    bm_nos = bmesh.new()
    for sx in (1.0, -1.0):
        add_uv_sphere_bm(bm_nos, (sx * 0.062, -0.468, 0.886), (0.014, 0.012, 0.012), segs=6, rings=4)
    nos_obj = create_mesh_object("Crock_Nostrils", bm_nos, mat_mouth, smooth=True)
    assign_rigid_weight(nos_obj, "Head")

    return head_obj, nos_obj


def build_crock_jaw(mat_yellow, mat_mouth, mat_outline):
    """Build Crockstar's hinged lower jaw with golden-yellow underside and dark mouth interior."""
    bm = bmesh.new()
    segs = 12
    profile = [
        (-0.040, 0.745, 0.170, 0.058),
        (-0.140, 0.735, 0.160, 0.056),
        (-0.260, 0.732, 0.145, 0.052),
        (-0.375, 0.736, 0.128, 0.048),
        (-0.460, 0.742, 0.104, 0.042),
        (-0.500, 0.748, 0.070, 0.032),
    ]
    rings = []
    for y, zc, rx, rz in profile:
        ring = []
        for s in range(segs):
            th = 2.0 * math.pi * s / segs
            cx = math.cos(th)
            sz = math.sin(th)
            if sz > 0.0:
                sz *= 0.45  # Flat upper surface inside mouth
            ring.append(bm.verts.new((cx * rx, y, zc + sz * rz)))
        rings.append(ring)

    for ri in range(len(rings) - 1):
        ra, rb = rings[ri], rings[ri + 1]
        for s in range(segs):
            sn = (s + 1) % segs
            f = bm.faces.new((ra[s], rb[s], rb[sn], ra[sn]))
            # Top faces inside the mouth get dark mouth material
            if f.calc_center_median().z > 0.752:
                f.material_index = 1

    back_pole = bm.verts.new((0.0, -0.020, 0.745))
    tip_pole = bm.verts.new((0.0, -0.518, 0.750))
    for s in range(segs):
        sn = (s + 1) % segs
        bm.faces.new((back_pole, rings[0][sn], rings[0][s]))
        bm.faces.new((rings[-1][s], rings[-1][sn], tip_pole))

    jaw_obj = create_mesh_object("Crock_Jaw", bm, [mat_yellow, mat_mouth], smooth=True)
    assign_rigid_weight(jaw_obj, "Jaw")
    apply_inverted_hull_outline(jaw_obj, mat_outline, thickness=0.015)
    return jaw_obj


def build_crock_teeth(mat_ivory):
    """Build individual conical white crocodile teeth along upper & lower jawlines."""
    bm_up = bmesh.new()
    bm_lo = bmesh.new()

    # Upper teeth pointing downward along the snout edge (visible in grin!)
    upper_specs = [
        (0.148, -0.220, 0.778, 0.022, 0.056),
        (0.138, -0.320, 0.774, 0.020, 0.052),
        (0.120, -0.410, 0.774, 0.022, 0.058),
        (0.082, -0.480, 0.778, 0.019, 0.048),
    ]
    for sx in (1.0, -1.0):
        for x, y, z, rad, length in upper_specs:
            add_cone_bm(bm_up, (sx * x, y, z), (sx * (x + 0.010), y, z - length), rad, segs=6)

    # Lower teeth pointing upward (including prominent mid-jaw croc tooth)
    lower_specs = [
        (0.142, -0.175, 0.752, 0.021, 0.052),
        (0.134, -0.270, 0.750, 0.024, 0.062),
        (0.114, -0.365, 0.752, 0.019, 0.048),
    ]
    for sx in (1.0, -1.0):
        for x, y, z, rad, length in lower_specs:
            add_cone_bm(bm_lo, (sx * x, y, z), (sx * (x + 0.010), y, z + length), rad, segs=6)

    up_obj = create_mesh_object("Crock_Teeth_Upper", bm_up, mat_ivory, smooth=False)
    assign_rigid_weight(up_obj, "Head")

    lo_obj = create_mesh_object("Crock_Teeth_Lower", bm_lo, mat_ivory, smooth=False)
    assign_rigid_weight(lo_obj, "Jaw")

    return up_obj, lo_obj


def build_crock_dorsal_spines(mat_olive_dark, mat_outline):
    """
    Build beveled triangular dorsal spine ridges running from the back of the head
    down the neck, spine, and all the way to the tail tip.
    """
    spine_objs = []
    # (y, z, height, width, depth, pitch_deg, bone_name)
    ridge_specs = [
        (0.115, 0.960, 0.070, 0.046, 0.075, -20.0, "Head"),
        (0.175, 0.855, 0.080, 0.050, 0.082, -45.0, "Head"),
        (0.215, 0.735, 0.088, 0.054, 0.088, -68.0, "Chest"),
        (0.242, 0.605, 0.095, 0.058, 0.095, -78.0, "Chest"),
        (0.258, 0.470, 0.098, 0.058, 0.095, -82.0, "Spine"),
        (0.260, 0.345, 0.092, 0.055, 0.090, -75.0, "Pelvis"),
        # Tail ridges
        (0.325, 0.295, 0.086, 0.050, 0.082, -25.0, "Tail_1"),
        (0.435, 0.278, 0.082, 0.046, 0.076, -10.0, "Tail_1"),
        (0.545, 0.285, 0.074, 0.042, 0.068,   6.0, "Tail_2"),
        (0.650, 0.312, 0.064, 0.036, 0.058,  18.0, "Tail_2"),
        (0.745, 0.355, 0.052, 0.030, 0.048,  26.0, "Tail_3"),
        (0.825, 0.402, 0.040, 0.024, 0.038,  30.0, "Tail_3"),
    ]

    for idx, (y, z, h, w, d, pitch_deg, bname) in enumerate(ridge_specs):
        bm = bmesh.new()
        rot = Matrix.Rotation(math.radians(pitch_deg), 3, 'X')
        base = Vector((0.0, y, z))

        # Beveled fin / dorsal ridge prism (6 verts base + 2 top ridge verts)
        local_pts = [
            Vector((-w * 0.5, -d * 0.5, -0.02)),
            Vector(( w * 0.5, -d * 0.5, -0.02)),
            Vector(( w * 0.5,  d * 0.5, -0.02)),
            Vector((-w * 0.5,  d * 0.5, -0.02)),
            Vector((-w * 0.22, -d * 0.18, h)),
            Vector(( w * 0.22, -d * 0.18, h)),
            Vector(( w * 0.18,  d * 0.22, h * 0.72)),
            Vector((-w * 0.18,  d * 0.22, h * 0.72)),
        ]
        vs = [bm.verts.new(base + (rot @ p)) for p in local_pts]
        bm.faces.new((vs[0], vs[3], vs[2], vs[1]))  # bottom
        bm.faces.new((vs[4], vs[5], vs[6], vs[7]))  # beveled top ridge
        bm.faces.new((vs[0], vs[1], vs[5], vs[4]))  # front
        bm.faces.new((vs[1], vs[2], vs[6], vs[5]))  # right
        bm.faces.new((vs[2], vs[3], vs[7], vs[6]))  # back
        bm.faces.new((vs[3], vs[0], vs[4], vs[7]))  # left

        obj = create_mesh_object(f"Crock_Spine_{idx:02d}", bm, mat_olive_dark, smooth=False)
        assign_rigid_weight(obj, bname)
        apply_inverted_hull_outline(obj, mat_outline, thickness=0.011)
        spine_objs.append(obj)

    return spine_objs


def build_crockstar():
    """Build, rig, animate, and export Crockstar -> public/models/crockstar.glb (~6,500 tris)."""
    reset_scene()

    # Materials matching references/characters_ref.png
    mat_olive = make_cel_material("Crock_Olive", 0x6E7F2C, roughness=0.84, specular=0.14)
    mat_olive_dark = make_cel_material("Crock_OliveDark", 0x4E5C1D, roughness=0.86, specular=0.12)
    mat_yellow = make_cel_material("Crock_Yellow", 0xE8C846, roughness=0.80, specular=0.15)
    mat_ivory = make_cel_material("Crock_Ivory", 0xF5F3E8, roughness=0.45, specular=0.25)
    mat_eye_white = make_cel_material("Crock_EyeWhite", 0xF6F3E4, roughness=0.40, specular=0.25)
    mat_pupil = make_cel_material("Crock_Pupil", 0x1A1512, roughness=0.12, specular=0.65)
    mat_mouth = make_cel_material("Crock_MouthDark", 0x262916, roughness=0.92, specular=0.05)
    mat_outline = make_outline_material("Crock_Outline_Black")

    # 1. Chunky bipedal torso (Z = 0.19 to 0.78)
    bm_torso = bmesh.new()
    torso_rings = [
        {'center': (0.0,  0.02, 0.195), 'rx': 0.195, 'ry': 0.185},
        {'center': (0.0,  0.01, 0.270), 'rx': 0.255, 'ry': 0.235},
        {'center': (0.0,  0.00, 0.370), 'rx': 0.262, 'ry': 0.242},
        {'center': (0.0,  0.00, 0.480), 'rx': 0.245, 'ry': 0.228},
        {'center': (0.0,  0.01, 0.590), 'rx': 0.215, 'ry': 0.205},
        {'center': (0.0,  0.02, 0.690), 'rx': 0.185, 'ry': 0.180},
        {'center': (0.0,  0.02, 0.775), 'rx': 0.155, 'ry': 0.155},
    ]
    add_lofted_tube_bm(bm_torso, torso_rings, segs=16, cap_start=True, cap_end=True)
    torso_obj = create_mesh_object("Crock_Torso", bm_torso, mat_olive, smooth=True)
    assign_gradient_weights(torso_obj, 'z', [
        (0.24, "Pelvis"),
        (0.45, "Spine"),
        (0.64, "Chest"),
        (0.76, "Head"),
    ])
    apply_inverted_hull_outline(torso_obj, mat_outline, thickness=0.018)

    # 2. Segmented yellow underbelly scute plates (flush on front of torso, no separate outline)
    bm_belly = bmesh.new()
    belly_bands = [
        (0.255, 0.130, 0.058, -0.215),
        (0.325, 0.152, 0.062, -0.236),
        (0.398, 0.156, 0.062, -0.240),
        (0.470, 0.146, 0.060, -0.228),
        (0.540, 0.130, 0.058, -0.212),
        (0.608, 0.112, 0.055, -0.194),
        (0.672, 0.095, 0.050, -0.175),
    ]
    for zc, rx, rz, y_front in belly_bands:
        add_uv_sphere_bm(bm_belly, (0.0, y_front + 0.026, zc), (rx, 0.044, rz * 0.82), segs=10, rings=5)
    belly_obj = create_mesh_object("Crock_Belly", bm_belly, mat_yellow, smooth=True)
    assign_gradient_weights(belly_obj, 'z', [
        (0.26, "Pelvis"),
        (0.45, "Spine"),
        (0.64, "Chest"),
    ])

    # 3. Head, Snout, Jaw, Teeth
    head_obj, nos_obj = build_crock_head_and_snout(mat_olive, mat_mouth, mat_outline)
    jaw_obj = build_crock_jaw(mat_yellow, mat_mouth, mat_outline)
    teeth_up, teeth_lo = build_crock_teeth(mat_ivory)

    # 4. Expressive cartoon eyes + pupils + highlights
    eye_objs = []
    for side, sx in (("L", 1.0), ("R", -1.0)):
        bm_eye = bmesh.new()
        add_uv_sphere_bm(bm_eye, (sx * 0.108, -0.180, 0.968), (0.064, 0.062, 0.068), segs=12, rings=8)
        eye_obj = create_mesh_object(f"Crock_Eye_{side}", bm_eye, mat_eye_white, smooth=True)
        assign_rigid_weight(eye_obj, "Head")
        apply_inverted_hull_outline(eye_obj, mat_outline, thickness=0.010)
        eye_objs.append(eye_obj)

        bm_pup = bmesh.new()
        add_uv_sphere_bm(bm_pup, (sx * 0.125, -0.228, 0.968), (0.032, 0.020, 0.035), segs=10, rings=6)
        pup_obj = create_mesh_object(f"Crock_Pupil_{side}", bm_pup, mat_pupil, smooth=True)
        assign_rigid_weight(pup_obj, "Head")
        eye_objs.append(pup_obj)

        bm_hi = bmesh.new()
        add_uv_sphere_bm(bm_hi, (sx * 0.125 - 0.010, -0.244, 0.980), (0.010, 0.007, 0.010), segs=6, rings=4)
        hi_obj = create_mesh_object(f"Crock_EyeHighlight_{side}", bm_hi, mat_eye_white, smooth=True)
        assign_rigid_weight(hi_obj, "Head")
        eye_objs.append(hi_obj)

    # 5. Muscular Tail curving backward and gently upward (with yellow underside!)
    bm_tail = bmesh.new()
    tail_segs = 12
    tail_profile = [
        # (y, z, rx, rz)
        (0.180, 0.285, 0.165, 0.145),
        (0.280, 0.245, 0.145, 0.125),
        (0.390, 0.228, 0.124, 0.106),
        (0.500, 0.232, 0.104, 0.088),
        (0.610, 0.258, 0.084, 0.072),
        (0.715, 0.302, 0.064, 0.056),
        (0.805, 0.355, 0.044, 0.040),
        (0.875, 0.405, 0.022, 0.022),
    ]
    t_rings = []
    for y, zc, rx, rz in tail_profile:
        ring = []
        for s in range(tail_segs):
            th = 2.0 * math.pi * s / tail_segs
            ring.append(bm_tail.verts.new((math.cos(th) * rx, y, zc + math.sin(th) * rz)))
        t_rings.append(ring)

    for ri in range(len(t_rings) - 1):
        ra, rb = t_rings[ri], t_rings[ri + 1]
        for s in range(tail_segs):
            sn = (s + 1) % tail_segs
            f = bm_tail.faces.new((ra[s], ra[sn], rb[sn], rb[s]))
            # Bottom faces of tail get yellow underbelly material
            ang = 2.0 * math.pi * (s + 0.5) / tail_segs
            if math.sin(ang) < -0.45:
                f.material_index = 1

    tail_tip = bm_tail.verts.new((0.0, 0.905, 0.425))
    tail_base = bm_tail.verts.new((0.0, 0.165, 0.285))
    for s in range(tail_segs):
        sn = (s + 1) % tail_segs
        bm_tail.faces.new((t_rings[-1][s], t_rings[-1][sn], tail_tip))
        bm_tail.faces.new((tail_base, t_rings[0][sn], t_rings[0][s]))

    tail_obj = create_mesh_object("Crock_Tail", bm_tail, [mat_olive, mat_yellow], smooth=True)
    assign_gradient_weights(tail_obj, 'y', [
        (0.20, "Pelvis"),
        (0.38, "Tail_1"),
        (0.60, "Tail_2"),
        (0.82, "Tail_3"),
    ])
    apply_inverted_hull_outline(tail_obj, mat_outline, thickness=0.016)

    # 6. Beveled Dorsal Spine Ridges down back & tail
    spine_objs = build_crock_dorsal_spines(mat_olive_dark, mat_outline)

    # 7. Stubby Clawed Arms
    arm_objs = []
    for side, sx in (("L", 1.0), ("R", -1.0)):
        bm_arm = bmesh.new()
        add_capsule_bm(
            bm_arm,
            p0=(sx * 0.210, -0.025, 0.555),
            p1=(sx * 0.275, -0.085, 0.340),
            r0=0.072,
            r1=0.056,
            segs=10,
            rings=4,
            cap_rings=2,
        )
        arm_obj = create_mesh_object(f"Crock_Arm_{side}", bm_arm, mat_olive, smooth=True)
        assign_rigid_weight(arm_obj, f"Arm_{side}")
        apply_inverted_hull_outline(arm_obj, mat_outline, thickness=0.014)
        arm_objs.append(arm_obj)

        # 3 small ivory claws per hand
        bm_claws = bmesh.new()
        for ci, off_y in enumerate((-0.028, 0.0, 0.028)):
            base = (sx * 0.278, -0.085 + off_y, 0.296)
            tip = (sx * 0.285, -0.108 + off_y, 0.252)
            add_cone_bm(bm_claws, base, tip, 0.014, segs=6)
        claw_obj = create_mesh_object(f"Crock_HandClaws_{side}", bm_claws, mat_ivory, smooth=False)
        assign_rigid_weight(claw_obj, f"Arm_{side}")
        arm_objs.append(claw_obj)

    # 8. Chunky Clawed Legs & Broad Feet (resting cleanly on Z = 0.0)
    leg_objs = []
    for side, sx in (("L", 1.0), ("R", -1.0)):
        bm_leg = bmesh.new()
        # Upper chunky leg
        add_capsule_bm(
            bm_leg,
            p0=(sx * 0.165, 0.015, 0.245),
            p1=(sx * 0.172, -0.010, 0.085),
            r0=0.095,
            r1=0.080,
            segs=10,
            rings=3,
            cap_rings=2,
        )
        # Broad foot pad resting on Z = 0.0
        add_uv_sphere_bm(bm_leg, (sx * 0.175, -0.055, 0.052), (0.092, 0.125, 0.052), segs=10, rings=6)
        leg_obj = create_mesh_object(f"Crock_Leg_{side}", bm_leg, mat_olive, smooth=True)
        assign_rigid_weight(leg_obj, f"Leg_{side}")
        apply_inverted_hull_outline(leg_obj, mat_outline, thickness=0.015)
        leg_objs.append(leg_obj)

        # 3 ivory toe claws per foot
        bm_toes = bmesh.new()
        for off_x in (-0.042, 0.0, 0.042):
            base = (sx * 0.175 + off_x, -0.160, 0.028)
            tip = (sx * 0.175 + off_x * 1.15, -0.215, 0.014)
            add_cone_bm(bm_toes, base, tip, 0.017, segs=6)
        toe_obj = create_mesh_object(f"Crock_FootClaws_{side}", bm_toes, mat_ivory, smooth=False)
        assign_rigid_weight(toe_obj, f"Leg_{side}")
        leg_objs.append(toe_obj)

    # 9. Subtle darker olive scale spots on flanks & cheeks (matching reference texture detail)
    bm_spots = bmesh.new()
    spot_coords = [
        ( 0.238,  0.08, 0.44, 0.028),
        (-0.238,  0.08, 0.44, 0.028),
        ( 0.215,  0.11, 0.56, 0.024),
        (-0.215,  0.11, 0.56, 0.024),
        ( 0.245,  0.06, 0.33, 0.025),
        (-0.245,  0.06, 0.33, 0.025),
    ]
    for x, y, z, r in spot_coords:
        add_uv_sphere_bm(bm_spots, (x, y, z), (r * 0.65, r, r), segs=6, rings=4)
    spots_obj = create_mesh_object("Crock_ScaleSpots", bm_spots, mat_olive_dark, smooth=True)
    assign_gradient_weights(spots_obj, 'z', [(0.30, "Pelvis"), (0.45, "Spine"), (0.60, "Chest")])

    all_meshes = (
        [torso_obj, belly_obj, head_obj, nos_obj, jaw_obj, teeth_up, teeth_lo, tail_obj, spots_obj]
        + eye_objs
        + spine_objs
        + arm_objs
        + leg_objs
    )

    # 10. Armature
    arm_data = bpy.data.armatures.new("Crockstar_Armature")
    arm_obj = bpy.data.objects.new("Crockstar_Rig", arm_data)
    bpy.context.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')

    eb = arm_data.edit_bones
    b_root = eb.new("Root")
    b_root.head = (0.0, 0.0, 0.0)
    b_root.tail = (0.0, 0.0, 0.22)

    b_pelvis = eb.new("Pelvis")
    b_pelvis.parent = b_root
    b_pelvis.head = (0.0, 0.01, 0.24)
    b_pelvis.tail = (0.0, 0.00, 0.40)

    b_spine = eb.new("Spine")
    b_spine.parent = b_pelvis
    b_spine.head = (0.0, 0.00, 0.40)
    b_spine.tail = (0.0, 0.01, 0.56)

    b_chest = eb.new("Chest")
    b_chest.parent = b_spine
    b_chest.head = (0.0, 0.01, 0.56)
    b_chest.tail = (0.0, 0.01, 0.74)

    b_head = eb.new("Head")
    b_head.parent = b_chest
    b_head.head = (0.0, 0.00, 0.76)
    b_head.tail = (0.0, -0.35, 0.85)

    b_jaw = eb.new("Jaw")
    b_jaw.parent = b_head
    b_jaw.head = (0.0, -0.06, 0.745)
    b_jaw.tail = (0.0, -0.45, 0.740)

    # Tail chain
    b_t1 = eb.new("Tail_1")
    b_t1.parent = b_pelvis
    b_t1.head = (0.0, 0.20, 0.27)
    b_t1.tail = (0.0, 0.44, 0.23)

    b_t2 = eb.new("Tail_2")
    b_t2.parent = b_t1
    b_t2.head = (0.0, 0.44, 0.23)
    b_t2.tail = (0.0, 0.68, 0.29)

    b_t3 = eb.new("Tail_3")
    b_t3.parent = b_t2
    b_t3.head = (0.0, 0.68, 0.29)
    b_t3.tail = (0.0, 0.90, 0.42)

    for side, sx in (("L", 1.0), ("R", -1.0)):
        ba = eb.new(f"Arm_{side}")
        ba.parent = b_chest
        ba.head = (sx * 0.21, -0.025, 0.56)
        ba.tail = (sx * 0.28, -0.085, 0.32)

        bl = eb.new(f"Leg_{side}")
        bl.parent = b_pelvis
        bl.head = (sx * 0.165, 0.01, 0.25)
        bl.tail = (sx * 0.175, -0.05, 0.0)

    bpy.ops.object.mode_set(mode='OBJECT')
    bind_to_armature(all_meshes, arm_obj)

    # 11. Animations -> NLA Tracks: Idle, Walk, Swim, Bite_Attack, Friendly_Sit
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='POSE')

    # --- Idle (48 frames) ---
    def anim_idle(arm):
        for f, zb, ch_s, jaw_o, t1, t2, t3 in [
            (1,  0.000, 1.00,  0.0,   0.0,   0.0,   0.0),
            (12, 0.015, 1.03, -4.0,  10.0,  14.0,  18.0),
            (24, 0.000, 1.00,  0.0,   0.0,   0.0,   0.0),
            (36, 0.015, 1.03, -3.0, -10.0, -14.0, -18.0),
            (48, 0.000, 1.00,  0.0,   0.0,   0.0,   0.0),
        ]:
            key_bone(arm, "Pelvis", f, loc=(0, 0, zb))
            key_bone(arm, "Chest", f, scale=(ch_s, ch_s, 1.0))
            key_bone(arm, "Jaw", f, rot_deg=(jaw_o, 0, 0))
            key_bone(arm, "Tail_1", f, rot_deg=(0, t1, 0))
            key_bone(arm, "Tail_2", f, rot_deg=(0, t2, 0))
            key_bone(arm, "Tail_3", f, rot_deg=(0, t3, 0))

    # --- Walk (28 frames): Heavy bipedal crocodile stomp ---
    def anim_walk(arm):
        frames = [
            (1,  0.00,  0.0,   0.0,   0.0,   0.0,   0.0,   0.0,   0.0),
            (7,  0.03, -6.0,  26.0, -20.0, -18.0,  18.0,  14.0,  18.0),
            (14, 0.00,  0.0,   0.0,   0.0,   0.0,   0.0,   0.0,   0.0),
            (21, 0.03,  6.0, -20.0,  26.0,  18.0, -18.0, -14.0, -18.0),
            (28, 0.00,  0.0,   0.0,   0.0,   0.0,   0.0,   0.0,   0.0),
        ]
        for f, zb, roll, leg_l, leg_r, arm_l, arm_r, t1, t2 in frames:
            key_bone(arm, "Pelvis", f, loc=(0, 0, zb), rot_deg=(5.0, roll, 0))
            key_bone(arm, "Head", f, rot_deg=(-4.0, -roll * 0.5, 0))
            key_bone(arm, "Leg_L", f, rot_deg=(leg_l, 0, 0))
            key_bone(arm, "Leg_R", f, rot_deg=(leg_r, 0, 0))
            key_bone(arm, "Arm_L", f, rot_deg=(arm_l, 0, 0))
            key_bone(arm, "Arm_R", f, rot_deg=(arm_r, 0, 0))
            key_bone(arm, "Tail_1", f, rot_deg=(0, t1, 0))
            key_bone(arm, "Tail_2", f, rot_deg=(0, t2, 0))

    # --- Swim (24 frames): Horizontal swimming posture + sinusoidal tail undulation ---
    def anim_swim(arm):
        frames = [
            (1,  -22.0, -28.0, -32.0,  15.0, -15.0,  8.0),
            (6,    0.0, -16.0, -24.0,   0.0,   0.0,  0.0),
            (12,  22.0,  28.0,  32.0, -15.0,  15.0, -8.0),
            (18,   0.0,  16.0,  24.0,   0.0,   0.0,  0.0),
            (24, -22.0, -28.0, -32.0,  15.0, -15.0,  8.0),
        ]
        for f, t1, t2, t3, kick_l, kick_r, yaw in frames:
            key_bone(arm, "Pelvis", f, loc=(0, 0, 0.08), rot_deg=(62.0, yaw * 0.5, 0))
            key_bone(arm, "Spine", f, rot_deg=(10.0, 0, 0))
            key_bone(arm, "Head", f, rot_deg=(-58.0, -yaw * 0.6, 0))
            key_bone(arm, "Arm_L", f, rot_deg=(35.0, 18.0, 0))
            key_bone(arm, "Arm_R", f, rot_deg=(35.0, -18.0, 0))
            key_bone(arm, "Leg_L", f, rot_deg=(-45.0 + kick_l, 0, 0))
            key_bone(arm, "Leg_R", f, rot_deg=(-45.0 + kick_r, 0, 0))
            key_bone(arm, "Tail_1", f, rot_deg=(-38.0, t1, 0))
            key_bone(arm, "Tail_2", f, rot_deg=(-10.0, t2, 0))
            key_bone(arm, "Tail_3", f, rot_deg=(-6.0, t3, 0))

    # --- Bite_Attack (26 frames): Wind-up, lunge forward, wide jaw open, snap chomp! ---
    def anim_bite(arm):
        # Neutral start
        key_bone(arm, "Pelvis", 1, loc=(0, 0, 0), rot_deg=(0, 0, 0))
        key_bone(arm, "Chest", 1, rot_deg=(0, 0, 0))
        key_bone(arm, "Head", 1, rot_deg=(0, 0, 0))
        key_bone(arm, "Jaw", 1, rot_deg=(0, 0, 0))
        key_bone(arm, "Tail_1", 1, rot_deg=(0, 0, 0))

        # Wind-up: lean back, open jaw wide
        key_bone(arm, "Pelvis", 7, loc=(0, 0.06, -0.02), rot_deg=(-12, 0, 0))
        key_bone(arm, "Chest", 7, rot_deg=(-10, 0, 0))
        key_bone(arm, "Head", 7, rot_deg=(-16, 0, 0))
        key_bone(arm, "Jaw", 8, rot_deg=(-42, 0, 0))
        key_bone(arm, "Arm_L", 7, rot_deg=(-30, -20, 0))
        key_bone(arm, "Arm_R", 7, rot_deg=(-30, 20, 0))
        key_bone(arm, "Tail_1", 7, rot_deg=(12, 14, 0))

        # Lunge & CHOMP!
        key_bone(arm, "Pelvis", 13, loc=(0, -0.14, 0.02), rot_deg=(18, 0, 0))
        key_bone(arm, "Chest", 13, rot_deg=(14, 0, 0))
        key_bone(arm, "Head", 13, rot_deg=(10, 0, 0))
        key_bone(arm, "Jaw", 13, rot_deg=(4, 0, 0))  # Snap shut!
        key_bone(arm, "Arm_L", 13, rot_deg=(35, 10, 0))
        key_bone(arm, "Arm_R", 13, rot_deg=(35, -10, 0))
        key_bone(arm, "Tail_1", 13, rot_deg=(-15, -20, 0))
        key_bone(arm, "Tail_2", 13, rot_deg=(-10, -24, 0))

        # Recoil settle
        key_bone(arm, "Pelvis", 20, loc=(0, -0.03, 0), rot_deg=(4, 0, 0))
        key_bone(arm, "Jaw", 20, rot_deg=(-6, 0, 0))

        # Return to neutral
        key_bone(arm, "Pelvis", 26, loc=(0, 0, 0), rot_deg=(0, 0, 0))
        key_bone(arm, "Chest", 26, rot_deg=(0, 0, 0))
        key_bone(arm, "Head", 26, rot_deg=(0, 0, 0))
        key_bone(arm, "Jaw", 26, rot_deg=(0, 0, 0))
        key_bone(arm, "Arm_L", 26, rot_deg=(0, 0, 0))
        key_bone(arm, "Arm_R", 26, rot_deg=(0, 0, 0))
        key_bone(arm, "Tail_1", 26, rot_deg=(0, 0, 0))
        key_bone(arm, "Tail_2", 26, rot_deg=(0, 0, 0))

    # --- Friendly_Sit (40 frames): Sits happily on haunches, legs forward, joyful tail wag ---
    def anim_friendly_sit(arm):
        for f, t1, t2, t3, head_r, jaw_o in [
            (1,  -16.0, -22.0, -26.0,  6.0, -8.0),
            (10,  16.0,  22.0,  26.0, -6.0, -14.0),
            (20, -16.0, -22.0, -26.0,  6.0, -8.0),
            (30,  16.0,  22.0,  26.0, -6.0, -14.0),
            (40, -16.0, -22.0, -26.0,  6.0, -8.0),
        ]:
            key_bone(arm, "Pelvis", f, loc=(0, 0.04, -0.14), rot_deg=(-12.0, 0, 0))
            key_bone(arm, "Spine", f, rot_deg=(8.0, 0, 0))
            key_bone(arm, "Head", f, rot_deg=(-4.0, head_r, 0))
            key_bone(arm, "Jaw", f, rot_deg=(jaw_o, 0, 0))
            key_bone(arm, "Leg_L", f, rot_deg=(-58.0, -12.0, 0))
            key_bone(arm, "Leg_R", f, rot_deg=(-58.0, 12.0, 0))
            key_bone(arm, "Arm_L", f, rot_deg=(18.0, -8.0, 0))
            key_bone(arm, "Arm_R", f, rot_deg=(18.0, 8.0, 0))
            key_bone(arm, "Tail_1", f, rot_deg=(10.0, t1, 0))
            key_bone(arm, "Tail_2", f, rot_deg=(4.0, t2, 0))
            key_bone(arm, "Tail_3", f, rot_deg=(0.0, t3, 0))

    build_nla_action(arm_obj, "Idle", anim_idle)
    build_nla_action(arm_obj, "Walk", anim_walk)
    build_nla_action(arm_obj, "Swim", anim_swim)
    build_nla_action(arm_obj, "Bite_Attack", anim_bite)
    build_nla_action(arm_obj, "Friendly_Sit", anim_friendly_sit)

    bpy.ops.object.mode_set(mode='OBJECT')
    tris = count_scene_tris()
    out_path = os.path.join(OUTPUT_DIR, "crockstar.glb")
    export_glb(out_path)
    print(f"[EXOTIC-003] Exported {out_path} | Tris: {tris} | NLA tracks: {[t.name for t in arm_obj.animation_data.nla_tracks]}")


# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    build_dos()
    build_crockstar()
    print("[EXOTIC-003] All companion models exported successfully.")


if __name__ == "__main__":
    main()
