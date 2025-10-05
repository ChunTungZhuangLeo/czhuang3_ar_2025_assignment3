var createScene = function () {
  // Scene & camera
  var scene = new BABYLON.Scene(engine);
  var ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 6, height: 6 }, scene);
  ground.isVisible = false;

  var camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);
  camera.setTarget(BABYLON.Vector3.Zero());
  camera.attachControl(canvas, true);

  // Geometry
  var sphere = BABYLON.MeshBuilder.CreateSphere("sphere", { diameter: 2, segments: 48 }, scene);
  sphere.position.set(1, 1, 0);

  var cylinder = BABYLON.MeshBuilder.CreateCylinder("cylinder", { height: 2, diameter: 1, tessellation: 64 }, scene);
  cylinder.position.set(-1, 1, 0);

  // ------------------ Shaders ------------------
  BABYLON.Effect.ShadersStore["customVertexShader"] = `
  precision highp float;

  attribute vec3 position;
  attribute vec3 normal;

  uniform mat4 world;
  uniform mat4 worldViewProjection;

  varying vec3 vPosW;
  varying vec3 vNormalW;

  void main() {
      vec4 pw = world * vec4(position, 1.0);
      vPosW = pw.xyz;

      // OK for uniform scale (assignment-safe). Avoid non-uniform scaling.
      vNormalW = normalize(mat3(world) * normal);

      gl_Position = worldViewProjection * vec4(position, 1.0);
  }`;

  BABYLON.Effect.ShadersStore["customFragmentShader"] = `
  precision highp float;

  varying vec3 vPosW;
  varying vec3 vNormalW;

  // Material
  uniform float uMatAmbient;
  uniform vec3  uMatDiffuse;
  uniform vec3  uMatSpecular;
  uniform float uMatShininess;

  // Camera
  uniform vec3 uCameraPos;

  // Light #1
  uniform vec3 uPointLightColor;
  uniform vec3 uPointLightPos;

  // Light #2
  uniform vec3 uPointLightColor2;
  uniform vec3 uPointLightPos2;

  vec3 shadePointLight(vec3 lColor, vec3 lPos, vec3 N, vec3 V, vec3 kd, vec3 ks, float shin) {
      // Direction & distance
      vec3 Lvec = lPos - vPosW;
      float dist = max(length(Lvec), 1e-6);
      vec3 L = Lvec / dist;

      // Diffuse
      float NdotL = max(dot(N, L), 0.0);
      vec3 diffuse = kd * NdotL;

      // Specular (Phong)
      vec3 R = reflect(-L, N);
      float RdotV = max(dot(R, V), 0.0);
      float spec = (NdotL > 0.0 && shin > 0.0) ? pow(RdotV, shin) : 0.0;
      vec3 specular = ks * spec;

      // Inverse-square attenuation
      float atten = 1.0 / max(dist * dist, 1e-3);

      return (diffuse + specular) * lColor * atten;
  }

  void main() {
      vec3 N = normalize(vNormalW);
      vec3 V = normalize(uCameraPos - vPosW);

      // Ambient
      vec3 color = uMatAmbient * uMatDiffuse;

      // Light #1
      color += shadePointLight(uPointLightColor,  uPointLightPos,  N, V, uMatDiffuse, uMatSpecular, uMatShininess);
      // Light #2
      color += shadePointLight(uPointLightColor2, uPointLightPos2, N, V, uMatDiffuse, uMatSpecular, uMatShininess);

      color = clamp(color, 0.0, 1.0);
      gl_FragColor = vec4(color, 1.0);
  }`;

  // ------------------ Material ------------------
  var shaderMat = new BABYLON.ShaderMaterial("custom", scene, "custom", {
    attributes: ["position", "normal"],
    uniforms: [
      "world", "worldViewProjection",
      "uCameraPos",
      "uMatAmbient", "uMatDiffuse", "uMatSpecular", "uMatShininess",
      "uPointLightColor", "uPointLightPos",
      "uPointLightColor2", "uPointLightPos2"   // expose 2nd light
    ]
  });

  // Material params (baseline that reads well)
  shaderMat.setFloat("uMatAmbient", 0.12);
  shaderMat.setColor3("uMatDiffuse",  new BABYLON.Color3(0.80, 0.20, 0.20));
  shaderMat.setColor3("uMatSpecular", new BABYLON.Color3(1.00, 1.00, 1.00));
  shaderMat.setFloat("uMatShininess", 64.0);

  // Light #1: warm, upper-left, fairly close
  shaderMat.setColor3("uPointLightColor", new BABYLON.Color3(1.05, 0.92, 0.82));
  shaderMat.setVector3("uPointLightPos",  new BABYLON.Vector3(-1.5, 1.8, 1.0));

  // Light #2: cool, lower-right, closer than original
  shaderMat.setColor3("uPointLightColor2", new BABYLON.Color3(0.75, 0.90, 1.10));
  shaderMat.setVector3("uPointLightPos2",  new BABYLON.Vector3(2.0, -0.4, -1.0));

  // Keep camera pos fresh
  shaderMat.setVector3("uCameraPos", camera.position);
  scene.onBeforeRenderObservable.add(function () {
    shaderMat.setVector3("uCameraPos", camera.position);
  });

  sphere.material = shaderMat;
  cylinder.material = shaderMat;

  return scene;
};
