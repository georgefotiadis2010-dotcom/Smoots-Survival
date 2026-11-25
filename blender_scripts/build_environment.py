"""
EXOTIC-005: Mid-Poly Environment Kit Builder (Project: Last Exotic)
Generates `public/models/env_kit.glb` with 11 stylized, cel/toon-ready modular
environment assets matching `references/environment_ui_ref.png`:

  Jungle:
    - Jungle_Canopy_Tree_Large
    - Jungle_Canopy_Tree_Small
    - Jungle_Foliage_Bush

  Ruins (1x1 grid aligned):
    - Ruin_Temple_Wall
    - Ruin_Sandstone_Floor
    - Ruin_Stone_Pillar
    - Ruin_Fire_Brazier (children: Ruin_Fire_Brazier_Stone, Ruin_Fire_Brazier_Flame)

  FBI Outpost Overlay:
    - FBI_Tactical_Tent (2x2 grid aligned)
    - FBI_Holding_Cage (sized for Smuff)
    - FBI_Tripod_Floodlight (children: FBI_Tripod_Floodlight_Body, FBI_Tripod_Floodlight_LightCone)
    - FBI_Caution_Barrier (1x1 grid aligned)

Usage:
    blender --background --python blender_scripts/build_environment.py
"""

import math
import os
import sys
import bpy
import bmesh
from mathutils import Matrix, Vector, Euler

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "public", "models")
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "env_kit.glb")


# ---------------------------------------------------------------------------
# Color & Material Helpers
# ---------------------------------------------------------------------------
def srgb_channel_to_linear(c: float) -> float:
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear_rgba(hex_str: str, alpha: float = 1.0):
    hex_str = hex_str.lstrip("#")
    r = int(hex_str[0:2], 16) / 255.0
    g = int(hex_str[2:4], 16) / 255.0
    b = int(hex_str[4:6], 16) / 255.0
    return (
        srgb_channel_to_linear(r),
        srgb_channel_to_linear(g),
        srgb_channel_to_linear(b),
        alpha,
    )


def create_toon_material(
    name: str,
    hex_color: str,
    roughness: float = 0.88,
    metallic: float = 0.0,
    specular: float = 0.12,
    emission_hex: str | None = None,
    emission_strength: float = 0.0,
    alpha: float = 1.0,
    backface_culling: bool = False,
):
    mat = bpy.data.materials.new(name=name)
    if not mat.node_tree:
        mat.use_nodes = True
    mat.use_backface_culling = backface_culling

    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    rgba = hex_to_linear_rgba(hex_color, alpha=1.0)
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = specular

    if emission_hex and emission_strength > 0.0:
        bsdf.inputs["Emission Color"].default_value = hex_to_linear_rgba(emission_hex)
        bsdf.inputs["Emission Strength"].default_value = emission_strength

    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        if hasattr(mat, "blend_method"):
            mat.blend_method = "BLEND"
        if hasattr(mat, "surface_render_method"):
            mat.surface_render_method = "BLENDED"

    return mat


def create_outline_material(name: str = "Outline_Black", hex_color: str = "#110d12"):
    """Unlit inverted-hull black outline material with backface culling enabled."""
    mat = bpy.data.materials.new(name=name)
    if not mat.node_tree:
        mat.use_nodes = True
    mat.use_backface_culling = True

    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    # Background / Emission shader directly into Output exports as KHR_materials_unlit in glTF
    emis = nt.nodes.new("ShaderNodeEmission")
    emis.inputs["Color"].default_value = hex_to_linear_rgba(hex_color)
    emis.inputs["Strength"].default_value = 1.0
    nt.links.new(emis.outputs["Emission"], out.inputs["Surface"])
    return mat


def build_materials() -> dict:
    mats = {
        # Outline
        "Outline": create_outline_material("Outline_Black", "#120e14"),
        # Jungle
        "Bark_Dark": create_toon_material("Mat_Bark_Dark", "#4d2f1c", roughness=0.92, specular=0.08),
        "Bark_Mid": create_toon_material("Mat_Bark_Mid", "#6b4328", roughness=0.90, specular=0.08),
        "Canopy_Deep": create_toon_material("Mat_Canopy_Deep", "#1a471f", roughness=0.86, specular=0.10),
        "Canopy_Mid": create_toon_material("Mat_Canopy_Mid", "#2f7d2b", roughness=0.84, specular=0.12),
        "Canopy_Bright": create_toon_material("Mat_Canopy_Bright", "#5eb832", roughness=0.82, specular=0.14),
        "Canopy_Lime": create_toon_material("Mat_Canopy_Lime", "#9ce042", roughness=0.80, specular=0.15),
        "Fern_Green": create_toon_material("Mat_Fern_Green", "#388c2e", roughness=0.84, specular=0.12),
        "Berry_Red": create_toon_material("Mat_Berry_Red", "#df4426", roughness=0.65, specular=0.25),
        # Ruins
        "Stone_Light": create_toon_material("Mat_Stone_Light", "#cca76c", roughness=0.90, specular=0.10),
        "Stone_Mid": create_toon_material("Mat_Stone_Mid", "#a87e4b", roughness=0.92, specular=0.08),
        "Stone_Dark": create_toon_material("Mat_Stone_Dark", "#73502f", roughness=0.94, specular=0.06),
        "Stone_Carved": create_toon_material("Mat_Stone_Carved", "#8c6d4c", roughness=0.90, specular=0.08),
        "Moss_Dark": create_toon_material("Mat_Moss_Dark", "#2d6323", roughness=0.88, specular=0.08),
        "Moss_Bright": create_toon_material("Mat_Moss_Bright", "#59a133", roughness=0.84, specular=0.12),
        "Charcoal": create_toon_material("Mat_Charcoal", "#241916", roughness=0.96, specular=0.04),
        "Ember": create_toon_material(
            "Mat_Ember", "#d93d12", roughness=0.70, emission_hex="#ff5114", emission_strength=1.8
        ),
        "Flame_Outer": create_toon_material(
            "Mat_Flame_Outer", "#f55d16", roughness=0.5, specular=0.0, emission_hex="#f55d16", emission_strength=2.0
        ),
        "Flame_Mid": create_toon_material(
            "Mat_Flame_Mid", "#ffae1c", roughness=0.5, specular=0.0, emission_hex="#ffae1c", emission_strength=2.4
        ),
        "Flame_Core": create_toon_material(
            "Mat_Flame_Core", "#fff359", roughness=0.5, specular=0.0, emission_hex="#fff359", emission_strength=3.0
        ),
        # FBI Outpost
        "FBI_Tent_Black": create_toon_material("Mat_FBI_Tent_Black", "#1e2228", roughness=0.88, specular=0.10),
        "FBI_Tent_Charcoal": create_toon_material("Mat_FBI_Tent_Charcoal", "#2e343e", roughness=0.85, specular=0.12),
        "FBI_Steel_Dark": create_toon_material(
            "Mat_FBI_Steel_Dark", "#363e48", roughness=0.42, metallic=0.72, specular=0.35
        ),
        "FBI_Steel_Mid": create_toon_material(
            "Mat_FBI_Steel_Mid", "#6e7b8a", roughness=0.34, metallic=0.82, specular=0.45
        ),
        "FBI_Steel_Light": create_toon_material(
            "Mat_FBI_Steel_Light", "#9daab8", roughness=0.28, metallic=0.86, specular=0.50
        ),
        "FBI_Yellow": create_toon_material("Mat_FBI_Yellow", "#f2c61b", roughness=0.55, specular=0.22),
        "FBI_Black_Trim": create_toon_material("Mat_FBI_Black_Trim", "#171a1f", roughness=0.72, specular=0.15),
        "FBI_Lamp_Lens": create_toon_material(
            "Mat_FBI_Lamp_Lens", "#f5faff", roughness=0.2, specular=0.5, emission_hex="#f2f8ff", emission_strength=3.5
        ),
        "FBI_Light_Cone": create_toon_material(
            "Mat_FBI_Light_Cone",
            "#fff6b8",
            roughness=1.0,
            specular=0.0,
            emission_hex="#fff6b8",
            emission_strength=1.1,
            alpha=0.22,
            backface_culling=False,
        ),
    }
    return mats


# ---------------------------------------------------------------------------
# BMesh Geometry Primitives & Outline Utilities
# ---------------------------------------------------------------------------
class MeshBuilder:
    """Helper wrapping a bmesh + material palette with optional inverted-hull outlining."""

    def __init__(self, mat_dict: dict):
        self.mat_dict = mat_dict
        self.materials: list = []
        self.mat_index_map: dict[str, int] = {}
        self.bm = bmesh.new()
        # Track faces that should receive an inverted-hull outline
        self.outline_bm = bmesh.new()

    def get_mat_idx(self, mat_key: str) -> int:
        if mat_key not in self.mat_index_map:
            idx = len(self.materials)
            self.materials.append(self.mat_dict[mat_key])
            self.mat_index_map[mat_key] = idx
        return self.mat_index_map[mat_key]

    def _add_to_bm(self, target_bm: bmesh.types.BMesh, geom_fn, mat_idx: int):
        existing_faces = set(target_bm.faces)
        geom_fn(target_bm)
        new_faces = [f for f in target_bm.faces if f not in existing_faces]
        for f in new_faces:
            f.material_index = mat_idx
            f.smooth = False
        return new_faces

    def add_box(
        self,
        size: tuple[float, float, float],
        center: tuple[float, float, float] = (0, 0, 0),
        rot: tuple[float, float, float] = (0, 0, 0),
        mat: str = "Stone_Mid",
        bevel: float = 0.0,
        outline: bool = True,
        smooth: bool = False,
    ):
        sx, sy, sz = size
        mat_idx = self.get_mat_idx(mat)
        xform = (
            Matrix.Translation(Vector(center))
            @ Euler(rot, "XYZ").to_matrix().to_4x4()
            @ Matrix.Diagonal((sx, sy, sz, 1.0))
        )

        def make(bm):
            ret = bmesh.ops.create_cube(bm, size=1.0, matrix=xform)
            verts = ret["verts"]
            if bevel > 0.0:
                edges = list({e for v in verts for e in v.link_edges})
                bmesh.ops.bevel(
                    bm,
                    geom=edges,
                    offset=bevel,
                    segments=1,
                    affect="EDGES",
                    clamp_overlap=True,
                )

        faces = self._add_to_bm(self.bm, make, mat_idx)
        for f in faces:
            f.smooth = smooth
        if outline:
            self._add_to_bm(self.outline_bm, make, 0)

    def add_cylinder(
        self,
        radius_bottom: float,
        radius_top: float,
        depth: float,
        segments: int = 8,
        center: tuple[float, float, float] = (0, 0, 0),
        rot: tuple[float, float, float] = (0, 0, 0),
        mat: str = "Bark_Dark",
        cap_ends: bool = True,
        outline: bool = True,
        smooth: bool = True,
    ):
        mat_idx = self.get_mat_idx(mat)
        xform = Matrix.Translation(Vector(center)) @ Euler(rot, "XYZ").to_matrix().to_4x4()

        def make(bm):
            bmesh.ops.create_cone(
                bm,
                cap_ends=cap_ends,
                cap_tris=False,
                segments=segments,
                radius1=radius_bottom,
                radius2=radius_top,
                depth=depth,
                matrix=xform,
            )

        faces = self._add_to_bm(self.bm, make, mat_idx)
        for f in faces:
            f.smooth = smooth
        if outline:
            self._add_to_bm(self.outline_bm, make, 0)

    def add_sphere(
        self,
        radius: float | tuple[float, float, float],
        center: tuple[float, float, float] = (0, 0, 0),
        rot: tuple[float, float, float] = (0, 0, 0),
        u_segments: int = 8,
        v_segments: int = 5,
        mat: str = "Canopy_Mid",
        outline: bool = True,
        smooth: bool = True,
        lumpy: float = 0.0,
        seed: int = 0,
    ):
        if isinstance(radius, (int, float)):
            rx = ry = rz = float(radius)
        else:
            rx, ry, rz = radius

        mat_idx = self.get_mat_idx(mat)
        xform = (
            Matrix.Translation(Vector(center))
            @ Euler(rot, "XYZ").to_matrix().to_4x4()
            @ Matrix.Diagonal((rx, ry, rz, 1.0))
        )

        def make(bm):
            ret = bmesh.ops.create_uvsphere(
                bm,
                u_segments=u_segments,
                v_segments=v_segments,
                radius=1.0,
            )
            verts = ret["verts"]
            if lumpy > 0.0:
                for i, v in enumerate(verts):
                    # Deterministic stylized organic lumpiness
                    n = math.sin(v.co.x * 3.7 + seed) * math.cos(v.co.y * 4.1 - seed * 0.7) * math.sin(v.co.z * 3.3 + seed * 1.3)
                    scale = 1.0 + lumpy * n
                    v.co *= scale
            bmesh.ops.transform(bm, matrix=xform, verts=verts)

        faces = self._add_to_bm(self.bm, make, mat_idx)
        for f in faces:
            f.smooth = smooth
        if outline:
            self._add_to_bm(self.outline_bm, make, 0)

    def add_icosphere(
        self,
        radius: float | tuple[float, float, float],
        center: tuple[float, float, float] = (0, 0, 0),
        rot: tuple[float, float, float] = (0, 0, 0),
        subdivisions: int = 1,
        mat: str = "Berry_Red",
        outline: bool = True,
        smooth: bool = True,
    ):
        if isinstance(radius, (int, float)):
            rx = ry = rz = float(radius)
        else:
            rx, ry, rz = radius

        mat_idx = self.get_mat_idx(mat)
        xform = (
            Matrix.Translation(Vector(center))
            @ Euler(rot, "XYZ").to_matrix().to_4x4()
            @ Matrix.Diagonal((rx, ry, rz, 1.0))
        )

        def make(bm):
            bmesh.ops.create_icosphere(
                bm,
                subdivisions=subdivisions,
                radius=1.0,
                matrix=xform,
            )

        faces = self._add_to_bm(self.bm, make, mat_idx)
        for f in faces:
            f.smooth = smooth
        if outline:
            self._add_to_bm(self.outline_bm, make, 0)

    def add_prism(
        self,
        verts_2d: list[tuple[float, float]],
        z_bottom: float,
        z_top: float,
        mat: str = "Stone_Mid",
        outline: bool = True,
        smooth: bool = False,
    ):
        """Extrude a 2D CCW polygon from z_bottom to z_top."""
        mat_idx = self.get_mat_idx(mat)

        def make(bm):
            bottom_verts = [bm.verts.new((x, y, z_bottom)) for (x, y) in verts_2d]
            top_verts = [bm.verts.new((x, y, z_top)) for (x, y) in verts_2d]
            n = len(verts_2d)
            bm.faces.new(list(reversed(bottom_verts)))
            bm.faces.new(top_verts)
            for i in range(n):
                j = (i + 1) % n
                bm.faces.new([bottom_verts[i], bottom_verts[j], top_verts[j], top_verts[i]])

        faces = self._add_to_bm(self.bm, make, mat_idx)
        for f in faces:
            f.smooth = smooth
        if outline:
            self._add_to_bm(self.outline_bm, make, 0)

    def add_custom_mesh(
        self,
        verts_list: list[tuple[float, float, float]],
        faces_list: list[tuple[int, ...]],
        mat: str,
        outline: bool = True,
        smooth: bool = False,
    ):
        mat_idx = self.get_mat_idx(mat)

        def make(bm):
            bm_verts = [bm.verts.new(co) for co in verts_list]
            for f_idx in faces_list:
                bm.faces.new([bm_verts[i] for i in f_idx])

        faces = self._add_to_bm(self.bm, make, mat_idx)
        for f in faces:
            f.smooth = smooth
        if outline:
            self._add_to_bm(self.outline_bm, make, 0)

    def finalize_object(
        self,
        name: str,
        outline_thickness: float = 0.022,
        location: tuple[float, float, float] = (0, 0, 0),
    ) -> bpy.types.Object:
        # Build inverted-hull outline and merge into self.bm
        if outline_thickness > 0.0 and len(self.outline_bm.verts) > 0:
            outline_idx = self.get_mat_idx("Outline")
            # Weld coincident verts so sharp corners extrude seamlessly without cracks
            bmesh.ops.remove_doubles(self.outline_bm, verts=self.outline_bm.verts, dist=0.0005)
            bmesh.ops.recalc_face_normals(self.outline_bm, faces=self.outline_bm.faces)
            self.outline_bm.normal_update()

            # Compute displacement along vertex normals, clamping ground contact to Z >= 0
            for v in self.outline_bm.verts:
                orig_z = v.co.z
                new_co = v.co + v.normal * outline_thickness
                if orig_z >= -0.005 and new_co.z < 0.0:
                    new_co.z = 0.0
                v.co = new_co

            # Flip normals inward for inverted-hull backface culling
            bmesh.ops.reverse_faces(self.outline_bm, faces=self.outline_bm.faces)

            # Copy outline_bm geometry into self.bm
            vert_map = {}
            for v in self.outline_bm.verts:
                vert_map[v.index] = self.bm.verts.new(v.co)
            for f in self.outline_bm.faces:
                try:
                    nf = self.bm.faces.new([vert_map[v.index] for v in f.verts])
                    nf.material_index = outline_idx
                    nf.smooth = False
                except ValueError:
                    pass

        # Recalculate main normals safely? No, outline faces must stay reversed!
        # Main faces were created with outward normals by bmesh.ops.

        mesh = bpy.data.meshes.new(name + "_Mesh")
        self.bm.to_mesh(mesh)
        self.bm.free()
        self.outline_bm.free()

        for m in self.materials:
            mesh.materials.append(m)

        # Generate simple box-projected UVs so glTF exporter always has valid TEXCOORD_0
        mesh.uv_layers.new(name="UVMap")
        uv_layer = mesh.uv_layers.active.data
        for poly in mesh.polygons:
            n = poly.normal
            ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
            for loop_idx in poly.loop_indices:
                v = mesh.vertices[mesh.loops[loop_idx].vertex_index].co
                if az >= ax and az >= ay:
                    uv_layer[loop_idx].uv = (v.x * 0.5 + 0.5, v.y * 0.5 + 0.5)
                elif ax >= ay:
                    uv_layer[loop_idx].uv = (v.y * 0.5 + 0.5, v.z * 0.5 + 0.5)
                else:
                    uv_layer[loop_idx].uv = (v.x * 0.5 + 0.5, v.z * 0.5 + 0.5)

        mesh.update()

        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.location = Vector(location)
        return obj


# ---------------------------------------------------------------------------
# 1. JUNGLE ASSETS
# ---------------------------------------------------------------------------
def build_jungle_tree_large(mats: dict, loc: tuple[float, float, float]) -> bpy.types.Object:
    mb = MeshBuilder(mats)

    # Chunky tapered trunk with subtle bend
    mb.add_cylinder(0.28, 0.21, 0.70, segments=8, center=(0.0, 0.0, 0.35), mat="Bark_Dark")
    mb.add_cylinder(0.21, 0.16, 0.75, segments=8, center=(0.03, 0.02, 1.03), rot=(0.06, -0.05, 0.0), mat="Bark_Mid")
    mb.add_cylinder(0.16, 0.12, 0.55, segments=8, center=(0.06, 0.03, 1.60), rot=(0.04, -0.04, 0.0), mat="Bark_Dark")

    # 4 flared tropical root buttresses anchored cleanly to Z=0
    for i in range(4):
        ang = i * (math.pi / 2.0) + 0.35
        rx = math.cos(ang) * 0.25
        ry = math.sin(ang) * 0.25
        mb.add_box(
            (0.24, 0.12, 0.30),
            center=(rx, ry, 0.18),
            rot=(0.0, 0.32, ang),
            mat="Bark_Mid" if i % 2 == 0 else "Bark_Dark",
            bevel=0.02,
        )

    # Layered rounded tropical canopy puffs (forest-deep -> mid -> bright -> lime highlights)
    # Tier 1: Deep shadow foliage base
    tier1 = [
        (-0.56, -0.35, 1.56, (0.58, 0.54, 0.40)),
        (0.58, -0.30, 1.58, (0.56, 0.52, 0.40)),
        (-0.42, 0.52, 1.60, (0.56, 0.54, 0.40)),
        (0.48, 0.46, 1.56, (0.55, 0.52, 0.40)),
    ]
    for idx, (x, y, z, rad) in enumerate(tier1):
        mb.add_sphere(rad, center=(x, y, z), u_segments=8, v_segments=5, mat="Canopy_Deep", lumpy=0.08, seed=idx + 1)

    # Tier 2: Lush mid-green mid-canopy
    tier2 = [
        (0.0, 0.0, 1.88, (0.68, 0.66, 0.46)),
        (-0.55, 0.10, 1.92, (0.52, 0.50, 0.40)),
        (0.56, 0.08, 1.94, (0.50, 0.48, 0.38)),
        (0.02, -0.52, 1.90, (0.52, 0.48, 0.38)),
        (0.04, 0.54, 1.94, (0.50, 0.48, 0.38)),
    ]
    for idx, (x, y, z, rad) in enumerate(tier2):
        mb.add_sphere(rad, center=(x, y, z), u_segments=8, v_segments=5, mat="Canopy_Mid", lumpy=0.08, seed=idx + 10)

    # Tier 3: Bright sunlit tropical green
    tier3 = [
        (-0.34, -0.22, 2.26, (0.46, 0.44, 0.35)),
        (0.36, -0.18, 2.28, (0.44, 0.42, 0.34)),
        (0.0, 0.32, 2.30, (0.46, 0.44, 0.35)),
    ]
    for idx, (x, y, z, rad) in enumerate(tier3):
        mb.add_sphere(rad, center=(x, y, z), u_segments=8, v_segments=5, mat="Canopy_Bright", lumpy=0.07, seed=idx + 20)

    # Tier 4: Bright lime-green sunlit crown puffs
    tier4 = [
        (-0.14, 0.05, 2.58, (0.38, 0.36, 0.28)),
        (0.20, -0.06, 2.54, (0.32, 0.30, 0.24)),
    ]
    for idx, (x, y, z, rad) in enumerate(tier4):
        mb.add_sphere(rad, center=(x, y, z), u_segments=8, v_segments=5, mat="Canopy_Lime", lumpy=0.06, seed=idx + 30)

    return mb.finalize_object("Jungle_Canopy_Tree_Large", outline_thickness=0.028, location=loc)


def build_jungle_tree_small(mats: dict, loc: tuple[float, float, float]) -> bpy.types.Object:
    mb = MeshBuilder(mats)

    # Compact chunky trunk + 3 roots
    mb.add_cylinder(0.20, 0.14, 0.60, segments=8, center=(0.0, 0.0, 0.30), mat="Bark_Dark")
    mb.add_cylinder(0.14, 0.10, 0.62, segments=8, center=(-0.03, 0.02, 0.88), rot=(-0.06, 0.07, 0.0), mat="Bark_Mid")
    for i in range(3):
        ang = i * (2.0 * math.pi / 3.0) + 0.2
        mb.add_box(
            (0.18, 0.10, 0.22),
            center=(math.cos(ang) * 0.17, math.sin(ang) * 0.17, 0.14),
            rot=(0.0, 0.28, ang),
            mat="Bark_Dark",
            bevel=0.015,
        )

    # Tier 1: Deep green lower puffs
    for idx, (x, y, z, rad) in enumerate([
        (-0.38, -0.24, 1.18, (0.42, 0.40, 0.30)),
        (0.40, -0.20, 1.20, (0.40, 0.38, 0.30)),
        (0.0, 0.38, 1.22, (0.42, 0.40, 0.30)),
    ]):
        mb.add_sphere(rad, center=(x, y, z), u_segments=8, v_segments=5, mat="Canopy_Deep", lumpy=0.08, seed=idx + 40)

    # Tier 2: Mid green puffs
    for idx, (x, y, z, rad) in enumerate([
        (0.0, 0.0, 1.46, (0.50, 0.48, 0.36)),
        (-0.34, 0.16, 1.44, (0.36, 0.34, 0.28)),
        (0.35, 0.14, 1.46, (0.36, 0.34, 0.28)),
    ]):
        mb.add_sphere(rad, center=(x, y, z), u_segments=8, v_segments=5, mat="Canopy_Mid", lumpy=0.08, seed=idx + 50)

    # Tier 3: Bright green & lime crown
    mb.add_sphere((0.36, 0.34, 0.28), center=(-0.12, -0.08, 1.72), u_segments=8, v_segments=5, mat="Canopy_Bright", lumpy=0.06, seed=60)
    mb.add_sphere((0.30, 0.28, 0.22), center=(0.16, 0.06, 1.84), u_segments=8, v_segments=5, mat="Canopy_Lime", lumpy=0.05, seed=61)

    return mb.finalize_object("Jungle_Canopy_Tree_Small", outline_thickness=0.025, location=loc)


def build_jungle_foliage_bush(mats: dict, loc: tuple[float, float, float]) -> bpy.types.Object:
    mb = MeshBuilder(mats)

    # Layered rounded foliage puffs (1x1 footprint, Z=0 base)
    puffs = [
        ((-0.24, -0.18, 0.23), (0.28, 0.26, 0.21), "Canopy_Deep"),
        ((0.24, -0.15, 0.23), (0.27, 0.25, 0.21), "Canopy_Deep"),
        ((0.0, 0.24, 0.24), (0.29, 0.26, 0.21), "Canopy_Deep"),
        ((0.0, 0.0, 0.36), (0.34, 0.32, 0.26), "Canopy_Mid"),
        ((-0.18, 0.10, 0.40), (0.24, 0.22, 0.20), "Canopy_Bright"),
        ((0.18, 0.04, 0.42), (0.22, 0.22, 0.19), "Canopy_Bright"),
        ((0.02, -0.05, 0.52), (0.22, 0.20, 0.17), "Canopy_Lime"),
    ]
    for idx, (c, r, m) in enumerate(puffs):
        mb.add_sphere(r, center=c, u_segments=8, v_segments=5, mat=m, lumpy=0.08, seed=idx + 70)

    # Radiating stylized tropical fern fronds around the base
    for i in range(6):
        ang = i * (2.0 * math.pi / 6.0) + 0.25
        ca, sa = math.cos(ang), math.sin(ang)
        # Build a curved 3D leaf blade (thickened diamond)
        pts = [
            (ca * 0.15, sa * 0.15, 0.08),
            (ca * 0.36 - sa * 0.08, sa * 0.36 + ca * 0.08, 0.16),
            (ca * 0.52, sa * 0.52, 0.06),
            (ca * 0.36 + sa * 0.08, sa * 0.36 - ca * 0.08, 0.16),
            (ca * 0.34, sa * 0.34, 0.10),
        ]
        faces = [
            (0, 1, 2),
            (0, 2, 3),
            (0, 4, 1),
            (1, 4, 2),
            (2, 4, 3),
            (3, 4, 0),
        ]
        mb.add_custom_mesh(pts, faces, mat="Fern_Green", outline=True, smooth=False)

    # Tropical red-orange berry accents (no outline needed on small berries)
    for bx, by, bz in [
        (-0.22, -0.22, 0.34),
        (0.26, -0.10, 0.35),
        (-0.08, 0.24, 0.42),
        (0.14, 0.18, 0.46),
        (0.04, -0.18, 0.48),
    ]:
        mb.add_icosphere(0.055, center=(bx, by, bz), subdivisions=1, mat="Berry_Red", outline=False)

    return mb.finalize_object("Jungle_Foliage_Bush", outline_thickness=0.018, location=loc)


# ---------------------------------------------------------------------------
# 2. RUINS ASSETS (Strictly 1x1 Grid Aligned)
# ---------------------------------------------------------------------------
def build_ruin_temple_wall(mats: dict, loc: tuple[float, float, float]) -> bpy.types.Object:
    mb = MeshBuilder(mats)

    # Strictly 1.0 wide (X in [-0.5, 0.5]), Y in [-0.42, 0.42], Z in [0.0, 1.32]
    # Stepped sandstone plinth base
    mb.add_box((1.00, 0.84, 0.18), center=(0.0, 0.0, 0.09), mat="Stone_Dark", bevel=0.015)
    mb.add_box((1.00, 0.76, 0.12), center=(0.0, 0.0, 0.24), mat="Stone_Mid", bevel=0.012)

    # Core wall spine
    mb.add_box((1.00, 0.62, 0.76), center=(0.0, 0.0, 0.68), mat="Stone_Dark")

    # Staggered beveled ashlar masonry blocks on front (-Y) and back (+Y)
    for side in (-1.0, 1.0):
        y_face = side * 0.32
        # Lower course (2 blocks)
        mb.add_box((0.47, 0.10, 0.24), center=(-0.25, y_face, 0.43), mat="Stone_Mid", bevel=0.012)
        mb.add_box((0.47, 0.10, 0.24), center=(0.25, y_face, 0.43), mat="Stone_Light", bevel=0.012)
        # Mid course (carved central relief panel flanked by stones)
        mb.add_box((0.24, 0.10, 0.24), center=(-0.37, y_face, 0.68), mat="Stone_Light", bevel=0.012)
        mb.add_box((0.44, 0.12, 0.24), center=(0.0, y_face + side * 0.01, 0.68), mat="Stone_Carved", bevel=0.012)
        mb.add_box((0.24, 0.10, 0.24), center=(0.37, y_face, 0.68), mat="Stone_Mid", bevel=0.012)
        # Carved inner diamond/glyph boss on central panel
        mb.add_box(
            (0.14, 0.06, 0.14),
            center=(0.0, y_face + side * 0.06, 0.68),
            rot=(0.0, math.pi / 4.0, 0.0),
            mat="Stone_Light",
            bevel=0.008,
            outline=False,
        )
        # Upper course (2 blocks)
        mb.add_box((0.47, 0.10, 0.22), center=(-0.25, y_face, 0.93), mat="Stone_Mid", bevel=0.012)
        mb.add_box((0.47, 0.10, 0.22), center=(0.25, y_face, 0.93), mat="Stone_Mid", bevel=0.012)

    # Stepped temple cornice & beveled capstone blocks
    mb.add_box((1.00, 0.80, 0.10), center=(0.0, 0.0, 1.11), mat="Stone_Dark", bevel=0.012)
    mb.add_box((0.48, 0.84, 0.14), center=(-0.25, 0.0, 1.24), mat="Stone_Light", bevel=0.018)
    mb.add_box((0.48, 0.84, 0.14), center=(0.25, 0.0, 1.24), mat="Stone_Mid", bevel=0.018)

    # Creeping tropical moss patches along top edge and base
    moss_clumps = [
        ((-0.30, -0.34, 1.29), (0.18, 0.13, 0.08), "Moss_Bright"),
        ((-0.14, -0.36, 1.25), (0.13, 0.10, 0.07), "Moss_Dark"),
        ((0.28, 0.34, 1.30), (0.20, 0.14, 0.08), "Moss_Bright"),
        ((0.36, -0.36, 0.20), (0.14, 0.11, 0.09), "Moss_Dark"),
        ((-0.38, 0.36, 0.22), (0.15, 0.12, 0.09), "Moss_Bright"),
    ]
    for idx, (c, r, m) in enumerate(moss_clumps):
        mb.add_icosphere(r, center=c, subdivisions=1, mat=m, outline=True)

    return mb.finalize_object("Ruin_Temple_Wall", outline_thickness=0.016, location=loc)


def build_ruin_sandstone_floor(mats: dict, loc: tuple[float, float, float]) -> bpy.types.Object:
    mb = MeshBuilder(mats)

    # Strictly 1.0 x 1.0 footprint (X in [-0.5, 0.5], Y in [-0.5, 0.5], Z in [0.0, 0.065])
    # Dark mortar bed slab
    mb.add_box((1.00, 1.00, 0.032), center=(0.0, 0.0, 0.016), mat="Stone_Dark", outline=False)

    # Outer ornate beveled border stones (4 sides framing an inner carved sandstone tile, matching ref)
    mb.add_box((0.94, 0.15, 0.032), center=(0.0, -0.40, 0.044), mat="Stone_Light", bevel=0.008, outline=True)
    mb.add_box((0.94, 0.15, 0.032), center=(0.0, 0.40, 0.044), mat="Stone_Mid", bevel=0.008, outline=True)
    mb.add_box((0.15, 0.62, 0.032), center=(-0.40, 0.0, 0.044), mat="Stone_Mid", bevel=0.008, outline=True)
    mb.add_box((0.15, 0.62, 0.032), center=(0.40, 0.0, 0.044), mat="Stone_Light", bevel=0.008, outline=True)

    # Inner cracked/split sandstone flagstones (4 slightly offset slabs forming a cracked center)
    mb.add_box((0.28, 0.27, 0.028), center=(-0.15, -0.15, 0.043), rot=(0.01, -0.01, 0.02), mat="Stone_Light", bevel=0.007, outline=True)
    mb.add_box((0.27, 0.28, 0.026), center=(0.15, -0.14, 0.042), rot=(-0.01, 0.01, -0.03), mat="Stone_Mid", bevel=0.007, outline=True)
    mb.add_box((0.27, 0.27, 0.029), center=(-0.14, 0.15, 0.044), rot=(0.01, 0.01, -0.02), mat="Stone_Mid", bevel=0.007, outline=True)
    mb.add_box((0.28, 0.27, 0.025), center=(0.15, 0.15, 0.041), rot=(-0.01, -0.01, 0.03), mat="Stone_Light", bevel=0.007, outline=True)

    # Center carved temple square relief medallion
    mb.add_box((0.16, 0.16, 0.014), center=(0.0, 0.0, 0.056), rot=(0.0, 0.0, math.pi / 4.0), mat="Stone_Carved", bevel=0.004, outline=False)

    # Small grass/moss tufts peeking from cracked seams & corners
    for cx, cy, mat_k in [
        (-0.44, -0.44, "Moss_Bright"),
        (0.43, 0.42, "Moss_Dark"),
        (0.02, -0.04, "Moss_Bright"),
        (-0.32, 0.30, "Moss_Dark"),
    ]:
        mb.add_icosphere((0.06, 0.05, 0.035), center=(cx, cy, 0.055), subdivisions=1, mat=mat_k, outline=False)

    return mb.finalize_object("Ruin_Sandstone_Floor", outline_thickness=0.008, location=loc)


def build_ruin_stone_pillar(mats: dict, loc: tuple[float, float, float]) -> bpy.types.Object:
    mb = MeshBuilder(mats)

    # 1x1 grid aligned (base 0.86 x 0.86, Z in [0.0, 2.20])
    # 2-tier stepped square plinth
    mb.add_box((0.86, 0.86, 0.18), center=(0.0, 0.0, 0.09), mat="Stone_Dark", bevel=0.015)
    mb.add_box((0.70, 0.70, 0.16), center=(0.0, 0.0, 0.26), mat="Stone_Mid", bevel=0.015)

    # Main carved pillar shaft
    mb.add_box((0.52, 0.52, 1.48), center=(0.0, 0.0, 1.08), mat="Stone_Mid", bevel=0.02)

    # 3 carved relief bands + temple glyph blocks up the shaft
    for z_band, m_key in [(0.62, "Stone_Carved"), (1.08, "Stone_Light"), (1.54, "Stone_Carved")]:
        mb.add_box((0.58, 0.58, 0.14), center=(0.0, 0.0, z_band), mat=m_key, bevel=0.01)
        # Small carved bosses on each face
        for dx, dy in [(0.30, 0.0), (-0.30, 0.0), (0.0, 0.30), (0.0, -0.30)]:
            mb.add_box((0.12, 0.12, 0.18), center=(dx, dy, z_band), mat="Stone_Light", bevel=0.008, outline=False)

    # Stepped flared capital/crown
    mb.add_box((0.68, 0.68, 0.14), center=(0.0, 0.0, 1.89), mat="Stone_Dark", bevel=0.015)
    mb.add_box((0.82, 0.82, 0.16), center=(0.0, 0.0, 2.04), mat="Stone_Light", bevel=0.018)
    mb.add_box((0.62, 0.62, 0.08), center=(0.0, 0.0, 2.16), mat="Stone_Mid", bevel=0.012)

    # Moss patches on plinth and crown
    for c, r, m in [
        ((-0.32, -0.32, 0.20), (0.14, 0.12, 0.09), "Moss_Bright"),
        ((0.30, 0.30, 2.12), (0.16, 0.14, 0.08), "Moss_Bright"),
        ((-0.26, 0.32, 2.08), (0.12, 0.11, 0.07), "Moss_Dark"),
        ((0.28, -0.28, 1.56), (0.11, 0.10, 0.08), "Moss_Dark"),
    ]:
        mb.add_icosphere(r, center=c, subdivisions=1, mat=m, outline=True)

    return mb.finalize_object("Ruin_Stone_Pillar", outline_thickness=0.020, location=loc)


def build_ruin_fire_brazier(mats: dict, loc: tuple[float, float, float]) -> bpy.types.Object:
    # Create top-level Empty at grid anchor so Three.js can animate the Flame child independently
    root = bpy.data.objects.new("Ruin_Fire_Brazier", None)
    bpy.context.scene.collection.objects.link(root)
    root.location = Vector(loc)

    # --- Stone pedestal & bowl ---
    mb_stone = MeshBuilder(mats)
    # Stepped square base (0.80 x 0.80)
    mb_stone.add_box((0.80, 0.80, 0.14), center=(0.0, 0.0, 0.07), mat="Stone_Dark", bevel=0.015)
    mb_stone.add_box((0.66, 0.66, 0.12), center=(0.0, 0.0, 0.20), mat="Stone_Mid", bevel=0.012)

    # Carved stone pedestal body
    mb_stone.add_box((0.54, 0.54, 0.42), center=(0.0, 0.0, 0.47), mat="Stone_Mid", bevel=0.018)
    # Carved circular/diamond emblems on all 4 sides
    for dx, dy in [(0.28, 0.0), (-0.28, 0.0), (0.0, 0.28), (0.0, -0.28)]:
        mb_stone.add_box(
            (0.16, 0.16, 0.16),
            center=(dx, dy, 0.47),
            rot=(0.0, math.pi / 4.0 if dy != 0 else 0.0, math.pi / 4.0 if dx != 0 else 0.0),
            mat="Stone_Carved",
            bevel=0.01,
            outline=False,
        )

    # Flared stone fire basin rim
    mb_stone.add_cylinder(0.32, 0.44, 0.26, segments=8, center=(0.0, 0.0, 0.81), mat="Stone_Light")
    mb_stone.add_cylinder(0.45, 0.43, 0.08, segments=8, center=(0.0, 0.0, 0.94), mat="Stone_Dark")

    # Dark charcoal bed & glowing ember chunks inside bowl
    mb_stone.add_cylinder(0.34, 0.34, 0.06, segments=8, center=(0.0, 0.0, 0.91), mat="Charcoal", outline=False)
    for ex, ey, ez in [
        (-0.14, 0.08, 0.95),
        (0.15, -0.06, 0.95),
        (0.02, 0.14, 0.96),
        (-0.06, -0.14, 0.95),
    ]:
        mb_stone.add_icosphere((0.08, 0.07, 0.05), center=(ex, ey, ez), subdivisions=1, mat="Ember", outline=False)

    stone_obj = mb_stone.finalize_object("Ruin_Fire_Brazier_Stone", outline_thickness=0.018, location=(0, 0, 0))
    stone_obj.parent = root

    # --- Stylized layered cel-shaded flame geometry ---
    mb_flame = MeshBuilder(mats)
    # Outer orange-red flame tongues (ring of 5 angled cones)
    for i in range(5):
        ang = i * (2.0 * math.pi / 5.0) + 0.2
        rx = math.cos(ang) * 0.14
        ry = math.sin(ang) * 0.14
        mb_flame.add_cylinder(
            0.13, 0.01, 0.42,
            segments=6,
            center=(rx, ry, 1.12),
            rot=(math.sin(ang) * 0.22, -math.cos(ang) * 0.22, ang),
            mat="Flame_Outer",
            outline=True,
            smooth=False,
        )

    # Mid bright gold-orange flame tongues (4 taller tongues)
    for i in range(4):
        ang = i * (math.pi / 2.0) + 0.55
        rx = math.cos(ang) * 0.07
        ry = math.sin(ang) * 0.07
        mb_flame.add_cylinder(
            0.11, 0.01, 0.48,
            segments=6,
            center=(rx, ry, 1.18),
            rot=(math.sin(ang) * 0.14, -math.cos(ang) * 0.14, ang),
            mat="Flame_Mid",
            outline=False,
            smooth=False,
        )

    # Inner bright lemon-yellow central flame spire (matching ref bright yellow fire)
    mb_flame.add_cylinder(0.11, 0.01, 0.52, segments=6, center=(0.0, 0.0, 1.24), mat="Flame_Core", outline=False, smooth=False)
    mb_flame.add_icosphere((0.16, 0.16, 0.12), center=(0.0, 0.0, 1.00), subdivisions=1, mat="Flame_Core", outline=False)

    flame_obj = mb_flame.finalize_object("Ruin_Fire_Brazier_Flame", outline_thickness=0.015, location=(0, 0, 0))
    flame_obj.parent = root

    return root


# ---------------------------------------------------------------------------
# 3. FBI OUTPOST OVERLAY ASSETS
# ---------------------------------------------------------------------------
def build_fbi_tactical_tent(mats: dict, loc: tuple[float, float, float]) -> bpy.types.Object:
    mb = MeshBuilder(mats)

    # 2x2 grid aligned (X in [-1.0, 1.0], Y in [-1.0, 1.0], Z in [0.0, 1.95])
    # 4 corner steel telescopic legs
    for sx in (-0.88, 0.88):
        for sy in (-0.88, 0.88):
            mb.add_cylinder(0.035, 0.030, 1.32, segments=6, center=(sx, sy, 0.66), mat="FBI_Steel_Dark")
            mb.add_box((0.12, 0.12, 0.04), center=(sx, sy, 0.02), mat="FBI_Black_Trim", bevel=0.005)

    # Rear and side tactical waterproof walls (open front at -Y for tactical outpost readability)
    mb.add_box((1.78, 0.05, 1.24), center=(0.0, 0.88, 0.64), mat="FBI_Tent_Black", bevel=0.01)
    mb.add_box((0.05, 1.76, 1.24), center=(-0.88, 0.0, 0.64), mat="FBI_Tent_Black", bevel=0.01)
    mb.add_box((0.05, 1.76, 1.24), center=(0.88, 0.0, 0.64), mat="FBI_Tent_Black", bevel=0.01)

    # Rolled-up front doorway awning flaps at -Y
    mb.add_cylinder(0.09, 0.09, 1.74, segments=8, center=(0.0, -0.88, 1.22), rot=(0.0, math.pi / 2.0, 0.0), mat="FBI_Tent_Charcoal")
    # Small side entrance flaps
    mb.add_box((0.28, 0.05, 1.20), center=(-0.74, -0.88, 0.62), mat="FBI_Tent_Charcoal", bevel=0.008)
    mb.add_box((0.28, 0.05, 1.20), center=(0.74, -0.88, 0.62), mat="FBI_Tent_Charcoal", bevel=0.008)

    # Pitched pyramid/hip tactical roof canopy
    roof_verts = [
        # Outer eaves (Z = 1.28)
        (-0.98, -0.98, 1.26),  # 0
        (0.98, -0.98, 1.26),   # 1
        (0.98, 0.98, 1.26),    # 2
        (-0.98, 0.98, 1.26),   # 3
        # Mid-slope ring (slight tactical tension sag)
        (-0.52, -0.52, 1.62),  # 4
        (0.52, -0.52, 1.62),   # 5
        (0.52, 0.52, 1.62),    # 6
        (-0.52, 0.52, 1.62),   # 7
        # Ridge peak (Z = 1.94)
        (-0.22, 0.0, 1.94),    # 8
        (0.22, 0.0, 1.94),     # 9
        # Underside inner eaves for closed solid roof
        (-0.92, -0.92, 1.22),  # 10
        (0.92, -0.92, 1.22),   # 11
        (0.92, 0.92, 1.22),    # 12
        (-0.92, 0.92, 1.22),   # 13
    ]
    roof_faces = [
        # Lower roof skirt
        (0, 1, 5, 4),
        (1, 2, 6, 5),
        (2, 3, 7, 6),
        (3, 0, 4, 7),
        # Upper roof to ridge
        (4, 5, 9, 8),
        (5, 6, 9),
        (6, 7, 8, 9),
        (7, 4, 8),
        # Rim thickness
        (0, 10, 11, 1),
        (1, 11, 12, 2),
        (2, 12, 13, 3),
        (3, 13, 10, 0),
        # Underside ceiling
        (10, 13, 12, 11),
    ]
    mb.add_custom_mesh(roof_verts, roof_faces, mat="FBI_Tent_Black", outline=True, smooth=False)

    # Front & side valance fascia skirts
    mb.add_box((1.96, 0.06, 0.16), center=(0.0, -0.95, 1.28), mat="FBI_Tent_Charcoal", bevel=0.008)
    mb.add_box((1.96, 0.06, 0.16), center=(0.0, 0.95, 1.28), mat="FBI_Tent_Charcoal", bevel=0.008)
    mb.add_box((0.06, 1.90, 0.16), center=(-0.95, 0.0, 1.28), mat="FBI_Tent_Charcoal", bevel=0.008)
    mb.add_box((0.06, 1.90, 0.16), center=(0.95, 0.0, 1.28), mat="FBI_Tent_Charcoal", bevel=0.008)

    # Gold/Yellow FBI insignia stripe & badge plates on front & back fascia
    mb.add_box((1.10, 0.04, 0.07), center=(0.0, -0.985, 1.29), mat="FBI_Yellow", bevel=0.005, outline=False)
    mb.add_box((0.36, 0.05, 0.11), center=(0.0, -0.99, 1.29), mat="FBI_Yellow", bevel=0.006, outline=False)
    mb.add_box((0.28, 0.055, 0.07), center=(0.0, -0.995, 1.29), mat="FBI_Black_Trim", outline=False)
    mb.add_box((1.10, 0.04, 0.06), center=(0.0, 0.985, 1.29), mat="FBI_Yellow", bevel=0.004, outline=False)

    # Interior tactical crate / table silhouette for depth
    mb.add_box((0.68, 0.42, 0.46), center=(0.32, 0.36, 0.23), mat="FBI_Steel_Dark", bevel=0.015)

    # 4 corner guy-line stakes
    for sx in (-0.98, 0.98):
        for sy in (-0.98, 0.98):
            mb.add_cylinder(0.025, 0.015, 0.14, segments=5, center=(sx, sy, 0.07), mat="FBI_Yellow", outline=False)

    return mb.finalize_object("FBI_Tactical_Tent", outline_thickness=0.022, location=loc)


def build_fbi_holding_cage(mats: dict, loc: tuple[float, float, float]) -> bpy.types.Object:
    mb = MeshBuilder(mats)

    # Sized for Smuff: 1.40 x 1.40 footprint, Z in [0.0, 1.55]
    # Heavy gunmetal base floor plate + 4 corner bumper feet
    mb.add_box((1.40, 1.40, 0.07), center=(0.0, 0.0, 0.065), mat="FBI_Steel_Dark", bevel=0.012)
    for sx in (-0.64, 0.64):
        for sy in (-0.64, 0.64):
            mb.add_box((0.14, 0.14, 0.04), center=(sx, sy, 0.02), mat="FBI_Black_Trim", bevel=0.005)

    # 4 heavy square steel corner posts
    for sx in (-0.65, 0.65):
        for sy in (-0.65, 0.65):
            mb.add_box((0.08, 0.08, 1.44), center=(sx, sy, 0.80), mat="FBI_Steel_Dark")

    # Top & mid perimeter horizontal steel rails
    for z_rail, thick in [(1.50, 0.08), (0.82, 0.05)]:
        mb.add_box((1.38, 0.06, thick), center=(0.0, -0.65, z_rail), mat="FBI_Steel_Dark")
        mb.add_box((1.38, 0.06, thick), center=(0.0, 0.65, z_rail), mat="FBI_Steel_Dark")
        mb.add_box((0.06, 1.38, thick), center=(-0.65, 0.0, z_rail), mat="FBI_Steel_Dark")
        mb.add_box((0.06, 1.38, thick), center=(0.65, 0.0, z_rail), mat="FBI_Steel_Dark")

    # Vertical prison bars (4 per side = 16 bars, 6-sided steel cylinders)
    bar_offsets = [-0.39, -0.13, 0.13, 0.39]
    for offset in bar_offsets:
        # Front & back
        mb.add_cylinder(0.022, 0.022, 1.40, segments=6, center=(offset, -0.65, 0.80), mat="FBI_Steel_Mid", outline=True)
        mb.add_cylinder(0.022, 0.022, 1.40, segments=6, center=(offset, 0.65, 0.80), mat="FBI_Steel_Mid", outline=True)
        # Left & right
        mb.add_cylinder(0.022, 0.022, 1.40, segments=6, center=(-0.65, offset, 0.80), mat="FBI_Steel_Mid", outline=True)
        mb.add_cylinder(0.022, 0.022, 1.40, segments=6, center=(0.65, offset, 0.80), mat="FBI_Steel_Mid", outline=True)

    # Roof crossbars (3 bars along X, 3 along Y)
    for offset in (-0.32, 0.0, 0.32):
        mb.add_cylinder(0.018, 0.018, 1.28, segments=6, center=(0.0, offset, 1.50), rot=(0.0, math.pi / 2.0, 0.0), mat="FBI_Steel_Mid", outline=False)
        mb.add_cylinder(0.018, 0.018, 1.28, segments=6, center=(offset, 0.0, 1.50), rot=(math.pi / 2.0, 0.0, 0.0), mat="FBI_Steel_Mid", outline=False)

    # Front door lock plate + heavy padlock + yellow FBI hazard placard
    mb.add_box((0.18, 0.09, 0.20), center=(0.24, -0.66, 0.82), mat="FBI_Steel_Light", bevel=0.008)
    mb.add_box((0.10, 0.06, 0.12), center=(0.24, -0.71, 0.77), mat="FBI_Yellow", bevel=0.008)
    # Padlock shackle
    mb.add_box((0.07, 0.04, 0.06), center=(0.24, -0.71, 0.85), mat="FBI_Steel_Light", outline=False)
    # Top FBI warning placard on front rail
    mb.add_box((0.46, 0.04, 0.12), center=(0.0, -0.69, 1.50), mat="FBI_Yellow", bevel=0.006, outline=False)
    mb.add_box((0.36, 0.045, 0.06), center=(0.0, -0.695, 1.50), mat="FBI_Black_Trim", outline=False)

    return mb.finalize_object("FBI_Holding_Cage", outline_thickness=0.014, location=loc)


def build_fbi_tripod_floodlight(mats: dict, loc: tuple[float, float, float]) -> bpy.types.Object:
    root = bpy.data.objects.new("FBI_Tripod_Floodlight", None)
    bpy.context.scene.collection.objects.link(root)
    root.location = Vector(loc)

    # --- Tripod & Floodlight Head Body ---
    mb = MeshBuilder(mats)

    # 3 splayed tripod legs anchored cleanly at Z=0 (spread radius ~0.38 within 1x1 cell)
    for i in range(3):
        ang = i * (2.0 * math.pi / 3.0) + math.pi / 6.0
        ca, sa = math.cos(ang), math.sin(ang)
        # Foot pad at Z=0
        mb.add_cylinder(0.045, 0.040, 0.04, segments=6, center=(ca * 0.36, sa * 0.36, 0.02), mat="FBI_Black_Trim")
        # Angled leg tube from foot (0.36, 0.03) to center hub (0, 0.68)
        mid_x, mid_y, mid_z = ca * 0.18, sa * 0.18, 0.355
        tilt = math.atan2(0.36, 0.65)
        mb.add_cylinder(
            0.024, 0.024, 0.74,
            segments=6,
            center=(mid_x, mid_y, mid_z),
            rot=(sa * tilt, -ca * tilt, 0.0),
            mat="FBI_Steel_Dark",
        )
        # Lower horizontal brace strut
        mb.add_cylinder(
            0.014, 0.014, 0.24,
            segments=5,
            center=(ca * 0.12, sa * 0.12, 0.30),
            rot=(sa * (math.pi / 2.0), -ca * (math.pi / 2.0), 0.0),
            mat="FBI_Steel_Mid",
            outline=False,
        )

    # Center tripod hub + telescopic mast + yellow locking collars
    mb.add_cylinder(0.065, 0.055, 0.12, segments=8, center=(0.0, 0.0, 0.68), mat="FBI_Black_Trim")
    mb.add_cylinder(0.032, 0.028, 0.52, segments=8, center=(0.0, 0.0, 0.96), mat="FBI_Steel_Dark")
    mb.add_cylinder(0.045, 0.045, 0.06, segments=8, center=(0.0, 0.0, 1.18), mat="FBI_Yellow")
    mb.add_cylinder(0.024, 0.022, 0.44, segments=8, center=(0.0, 0.0, 1.42), mat="FBI_Steel_Mid")
    mb.add_cylinder(0.040, 0.040, 0.06, segments=8, center=(0.0, 0.0, 1.62), mat="FBI_Yellow")

    # Top T-bar mounting yoke
    mb.add_box((0.52, 0.05, 0.05), center=(0.0, 0.0, 1.66), mat="FBI_Steel_Dark", bevel=0.006)

    # Twin tactical LED floodlight housings angled slightly downward (-28 deg around X, facing -Y)
    pitch = -0.48
    for sx in (-0.17, 0.17):
        # Mounting bracket
        mb.add_box((0.06, 0.06, 0.10), center=(sx, 0.0, 1.72), mat="FBI_Black_Trim")
        # Lamp housing
        mb.add_box((0.24, 0.14, 0.20), center=(sx, -0.02, 1.78), rot=(pitch, 0.0, 0.0), mat="FBI_Steel_Dark", bevel=0.012)
        # Yellow protective bumper frame
        mb.add_box((0.26, 0.04, 0.22), center=(sx, -0.08, 1.75), rot=(pitch, 0.0, 0.0), mat="FBI_Yellow", bevel=0.008)
        # Bright emissive LED lens face
        mb.add_box((0.20, 0.03, 0.16), center=(sx, -0.095, 1.74), rot=(pitch, 0.0, 0.0), mat="FBI_Lamp_Lens", outline=False)

    body_obj = mb.finalize_object("FBI_Tripod_Floodlight_Body", outline_thickness=0.015, location=(0, 0, 0))
    body_obj.parent = root

    # --- Translucent Volumetric Light Cone Mesh (no outline, BLEND alpha) ---
    # Projects from twin lamp head (0, -0.10, 1.74) forward/downward to ground at Z=0.03
    mb_cone = MeshBuilder(mats)
    segs = 16
    cone_verts = []
    # Top ring at lamp face
    for i in range(segs):
        a = i * (2.0 * math.pi / segs)
        cone_verts.append((math.cos(a) * 0.28, -0.10 + math.sin(a) * 0.06, 1.74 + math.sin(a) * 0.08))
    # Bottom ring terminating cleanly above ground plane (Z = 0.03)
    for i in range(segs):
        a = i * (2.0 * math.pi / segs)
        cone_verts.append((math.cos(a) * 0.90, -1.55 + math.sin(a) * 0.68, 0.03))
    cone_faces = []
    for i in range(segs):
        j = (i + 1) % segs
        cone_faces.append((i, j, segs + j, segs + i))
    mb_cone.add_custom_mesh(cone_verts, cone_faces, mat="FBI_Light_Cone", outline=False, smooth=True)
    cone_obj = mb_cone.finalize_object("FBI_Tripod_Floodlight_LightCone", outline_thickness=0.0, location=(0, 0, 0))
    cone_obj.parent = root

    return root


def build_fbi_caution_barrier(mats: dict, loc: tuple[float, float, float]) -> bpy.types.Object:
    mb = MeshBuilder(mats)

    # Strictly 1x1 grid aligned (X in [-0.5, 0.5], Z in [0.0, 0.94])
    # Two weighted stanchion posts at X = -0.40 and +0.40
    for sx in (-0.40, 0.40):
        # Weighted black rubber octagonal base
        mb.add_cylinder(0.14, 0.12, 0.07, segments=8, center=(sx, 0.0, 0.035), mat="FBI_Black_Trim")
        # Vertical stanchion post
        mb.add_cylinder(0.035, 0.032, 0.84, segments=8, center=(sx, 0.0, 0.48), mat="FBI_Steel_Dark")
        # Yellow reflective warning collars
        mb.add_cylinder(0.039, 0.039, 0.09, segments=8, center=(sx, 0.0, 0.78), mat="FBI_Yellow")
        mb.add_cylinder(0.039, 0.039, 0.08, segments=8, center=(sx, 0.0, 0.46), mat="FBI_Yellow")
        # Rounded top cap
        mb.add_sphere(0.045, center=(sx, 0.0, 0.90), u_segments=8, v_segments=4, mat="FBI_Black_Trim")

    # Dual horizontal yellow/black striped caution tape ribbons spanning X in [-0.50, 0.50]
    num_stripes = 10
    stripe_w = 1.00 / num_stripes
    for z_tape, sag in [(0.78, 0.035), (0.46, 0.025)]:
        for i in range(num_stripes):
            x0 = -0.50 + i * stripe_w
            x1 = x0 + stripe_w
            xm = 0.5 * (x0 + x1)
            # Subtle catenary sag in the middle
            t = (xm / 0.50) ** 2
            z_cur = z_tape - sag * (1.0 - t)
            mat_k = "FBI_Yellow" if i % 2 == 0 else "FBI_Black_Trim"
            mb.add_box(
                (stripe_w + 0.002, 0.016, 0.075),
                center=(xm, 0.0, z_cur),
                mat=mat_k,
                outline=True,
            )

    return mb.finalize_object("FBI_Caution_Barrier", outline_thickness=0.010, location=loc)


# ---------------------------------------------------------------------------
# Verification & Scene Helpers
# ---------------------------------------------------------------------------
def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def count_object_tris(obj: bpy.types.Object) -> int:
    total = 0
    if obj.type == "MESH" and obj.data:
        for poly in obj.data.polygons:
            total += max(0, len(poly.vertices) - 2)
    for child in obj.children:
        total += count_object_tris(child)
    return total


def compute_local_bounds(obj: bpy.types.Object):
    """Return min/max bounds relative to obj's own origin."""
    mins = Vector((1e9, 1e9, 1e9))
    maxs = Vector((-1e9, -1e9, -1e9))

    def visit(o, rel_mat):
        if o.type == "MESH" and o.data:
            for v in o.data.vertices:
                p = rel_mat @ v.co
                mins.x = min(mins.x, p.x)
                mins.y = min(mins.y, p.y)
                mins.z = min(mins.z, p.z)
                maxs.x = max(maxs.x, p.x)
                maxs.y = max(maxs.y, p.y)
                maxs.z = max(maxs.z, p.z)
        for ch in o.children:
            visit(ch, rel_mat @ ch.matrix_local)

    visit(obj, Matrix.Identity(4))
    return mins, maxs


def main():
    clear_scene()
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    mats = build_materials()

    # Lay out all modular assets on clean spaced grid anchors (4m apart)
    # Row 0 (Y = 0): Jungle
    # Row 1 (Y = 4): Ruins
    # Row 2 (Y = 8): FBI Outpost
    assets = [
        build_jungle_tree_large(mats, (0.0, 0.0, 0.0)),
        build_jungle_tree_small(mats, (4.0, 0.0, 0.0)),
        build_jungle_foliage_bush(mats, (8.0, 0.0, 0.0)),
        build_ruin_temple_wall(mats, (0.0, 4.0, 0.0)),
        build_ruin_sandstone_floor(mats, (4.0, 4.0, 0.0)),
        build_ruin_stone_pillar(mats, (8.0, 4.0, 0.0)),
        build_ruin_fire_brazier(mats, (12.0, 4.0, 0.0)),
        build_fbi_tactical_tent(mats, (0.0, 8.0, 0.0)),
        build_fbi_holding_cage(mats, (4.0, 8.0, 0.0)),
        build_fbi_tripod_floodlight(mats, (8.0, 8.0, 0.0)),
        build_fbi_caution_barrier(mats, (12.0, 8.0, 0.0)),
    ]

    print("\n=== EXOTIC-005 Environment Kit Asset Report ===")
    budget_ok = True
    for obj in assets:
        tris = count_object_tris(obj)
        bmin, bmax = compute_local_bounds(obj)
        size = bmax - bmin
        status = "OK" if 500 <= tris <= 2500 else "OUT_OF_BUDGET"
        if status != "OK":
            budget_ok = False
        print(
            f"  - {obj.name:28s} | {tris:5d} tris [{status}] | "
            f"size=({size.x:.2f}, {size.y:.2f}, {size.z:.2f}) | min_z={bmin.z:.3f}"
        )

    if not budget_ok:
        print("ERROR: One or more modular assets are outside the 500-2,500 tris budget!", file=sys.stderr)
        sys.exit(1)

    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_animations=False,
    )

    if not os.path.exists(OUTPUT_PATH):
        print(f"ERROR: Export failed, {OUTPUT_PATH} not found!", file=sys.stderr)
        sys.exit(1)

    file_kb = os.path.getsize(OUTPUT_PATH) / 1024.0
    print(f"\nExported: {OUTPUT_PATH} ({file_kb:.1f} KB)")
    print("===============================================\n")


if __name__ == "__main__":
    main()
