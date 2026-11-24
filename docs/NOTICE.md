[正體中文](zh-TW/NOTICE.md) · **English**

# Notice

- This is an **unofficial** personal learning tool. It is not affiliated with, sponsored by or endorsed by Innovation First International, Inc., VEX Robotics or the REC Foundation.
- VEX, VEX IQ, VEXcode and Level Up are their trademarks, used here only to describe who this tool is for.
- Season rules, scoring and robot requirements are summarized in our own words from the official Game Manual and **may be outdated or wrong**. For competition, always follow the latest official version.
- This project **does not include** the official manual's text, images, fonts or any VEXcode code. The interface is a fresh implementation inspired by the style of VEXcode IQ.
- The simulator uses simplified physics for teaching and differs from a real robot; a program that passes in the simulator is not guaranteed to work on hardware.
- Please do not use this project to collect children's full names, schools, contact details or other personal data.

## Third-party software

| Component | Version | License | Where | Source |
| :--- | :--- | :--- | :--- | :--- |
| Three.js (3D engine for the 3D arena and the 3D parts viewer) | r147 | MIT (header kept in the file) | `web/vendor/three.min.js` | https://threejs.org / https://github.com/mrdoob/three.js |
| Three.js GLTFLoader (3D glTF/GLB loader for optional local CAD models) | r147 | MIT | `web/vendor/GLTFLoader.js` | https://github.com/mrdoob/three.js |

This open-source repository **does not bundle** official VEX CAD files. Self-hosters may optionally convert official VEX IQ `.STEP` files into `web/models/*.glb` locally (gitignored) using `tools/convert_vex_cad.py`. The 3D arena models are generated in code as **illustrative shapes, not official VEX CAD**.
