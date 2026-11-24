#!/usr/bin/env python3
"""將本機 local/cad/ 內的官方 VEX IQ STEP 檔案批次轉為輕量 .glb，輸出到 web/models/。
用法：uv run --python 3.12 --with cascadio --with trimesh python tools/convert_vex_cad.py
"""
import tempfile
import zipfile
from pathlib import Path
import cascadio
import trimesh

ROOT = Path(__file__).resolve().parent.parent
CAD_DIR = ROOT / "local" / "cad"
OUT_DIR = ROOT / "web" / "models"
OUT_DIR.mkdir(parents=True, exist_ok=True)

CONTROL_ZIP = CAD_DIR / "VEX-IQ-All-Control-STEP.zip"
PARTS_ZIP = CAD_DIR / "VEX-IQ-All-Parts-2024-11-08.zip"

# (part_id, zip_path, member_name, tol_linear, tol_angular)
TARGETS = [
    ("brain", CONTROL_ZIP, "VEX-IQ-All-Control-STEP/228-2540 VEX IQ Robot Brain/228-2540.STEP", 0.45, 0.55),
    ("controller", CONTROL_ZIP, "VEX-IQ-All-Control-STEP/228-2530 VEX IQ Controller/228-2530.STEP", 0.45, 0.55),
    ("motor", CONTROL_ZIP, "VEX-IQ-All-Control-STEP/228 2560 VEX IQ Smart Motor/228-2560.STEP", 0.35, 0.5),
    ("battery", CONTROL_ZIP, "VEX-IQ-All-Control-STEP/228-2604 VEX IQ Robot Battery/228-2604.STEP", 0.35, 0.5),
    ("radio", CONTROL_ZIP, "VEX-IQ-All-Control-STEP/228-2621 VEX IQ 900 MHz Radio/228-2621.STEP", 0.3, 0.5),
    ("bumper", CONTROL_ZIP, "VEX-IQ-All-Control-STEP/228-2677 VEX IQ Bumper Switch/228-2677.STEP", 0.3, 0.5),
    ("smartcable", CONTROL_ZIP, "VEX-IQ-All-Control-STEP/228-2780 VEX IQ Cable Pack/228-2780 - Simulated Cable.STEP", 0.35, 0.5),
    ("touchled", CONTROL_ZIP, "VEX-IQ-All-Control-STEP/228-3010 VEX IQ Touch Sensor/228-3010.STEP", 0.3, 0.5),
    ("distance", CONTROL_ZIP, "VEX-IQ-All-Control-STEP/228-3011 VEX IQ Distance Sensor/228-3011.STEP", 0.3, 0.5),
    ("color", CONTROL_ZIP, "VEX-IQ-All-Control-STEP/228-3012 VEX IQ Color Sensor/228-3012.STEP", 0.3, 0.5),
    ("gyro", CONTROL_ZIP, "VEX-IQ-All-Control-STEP/228-3014 VEX IQ Gyro Sensor/228-3014.STEP", 0.3, 0.5),
    ("rubberband", PARTS_ZIP, "Silicone Rubber Band #32 (228-2500-468).step", 0.25, 0.45),
    ("beam", PARTS_ZIP, "2x12 Beam (228-2500-026).step", 0.25, 0.45),
    ("pin", PARTS_ZIP, "2x2 Connector Pin (228-2500-062).step", 0.18, 0.45),
    ("standoff", PARTS_ZIP, "2x Pitch Standoff (228-2500-067).step", 0.2, 0.45),
    ("shaft", PARTS_ZIP, "4x Pitch Shaft (228-2500-120).step", 0.2, 0.45),
    ("gear", PARTS_ZIP, "36 Tooth Gear (228-2500-214).step", 0.25, 0.45),
    ("sprocket", PARTS_ZIP, "24 Tooth Sprocket (228-2500-235).step", 0.25, 0.45),
    ("wheel", PARTS_ZIP, "2x Wide, 3.5x Pitch Diameter Balloon Tire (Chevron Offroad Tread) (228-2500-1952).step", 0.45, 0.55),
]


def normalize_glb(src_glb: Path, dst_glb: Path):
    scene = trimesh.load(str(src_glb), force="scene")
    bounds = scene.bounds
    if bounds is not None:
        center = (bounds[0] + bounds[1]) / 2.0
        size = max(bounds[1] - bounds[0])
        scale = 2.6 / size if size > 1e-6 else 1.0
        mat = trimesh.transformations.scale_matrix(scale) @ trimesh.transformations.translation_matrix(-center)
        scene.apply_transform(mat)
    scene.export(str(dst_glb))


def main():
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        z_cache = {}
        try:
            for part_id, zpath, member, t_lin, t_ang in TARGETS:
                if not zpath.exists():
                    print(f"[SKIP] missing zip {zpath.name} for {part_id}")
                    continue
                zf = z_cache.setdefault(zpath, zipfile.ZipFile(zpath))
                if member not in zf.namelist():
                    print(f"[SKIP] missing {member} for {part_id}")
                    continue
                step_file = tmp_path / f"{part_id}.step"
                raw_glb = tmp_path / f"{part_id}_raw.glb"
                out_glb = OUT_DIR / f"{part_id}.glb"
                step_file.write_bytes(zf.read(member))
                cascadio.step_to_glb(str(step_file), str(raw_glb), tol_linear=t_lin, tol_angular=t_ang)
                normalize_glb(raw_glb, out_glb)
                kb = out_glb.stat().st_size / 1024
                print(f"[OK] {part_id:12s} -> {out_glb.name:18s} ({kb:6.1f} KB)")
        finally:
            for zf in z_cache.values():
                zf.close()


if __name__ == "__main__":
    main()
