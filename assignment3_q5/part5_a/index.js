var createScene = function () {
  var scene = new BABYLON.Scene(engine);
  var ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 6, height: 6 }, scene);
  ground.isVisible = false;

  var camera = new BABYLON.FreeCamera("cam", new BABYLON.Vector3(0, 5, -10), scene);
  camera.setTarget(BABYLON.Vector3.Zero());
  camera.attachControl(canvas, true);

  var sphere = BABYLON.MeshBuilder.CreateSphere("sphere", { diameter: 2, segments: 48 }, scene);
  sphere.position.set(1, 1, 0);
  var cylinder = BABYLON.MeshBuilder.CreateCylinder("cylinder",{ height: 2, diameter: 1, tessellation: 64 }, scene);
  cylinder.position.set(-1, 1, 0);

  BABYLON.Effect.ShadersStore["customVertexShader"] = `
  precision highp float;
  attribute vec3 position, normal;
  uniform mat4 world, worldViewProjection;
  varying vec3 vPosW, vNormalW;
  void main() {
    vec4 pw = world * vec4(position, 1.0);
    vPosW = pw.xyz;
    vNormalW = normalize(mat3(world) * normal);
    gl_Position = worldViewProjection * vec4(position, 1.0);
  }`;

  BABYLON.Effect.ShadersStore["customFragmentShader"] = `
  precision highp float;
  varying vec3 vPosW, vNormalW;
  uniform float uMatAmbient, uMatShininess;
  uniform vec3  uMatDiffuse, uMatSpecular;
  uniform vec3 uCameraPos;
  uniform vec3 uPointLightColor, uPointLightPos;

  vec3 shadePointLight(vec3 lCol, vec3 lPos, vec3 N, vec3 V, vec3 kd, vec3 ks, float shin) {
    vec3 Lvec = lPos - vPosW;
    float dist = max(length(Lvec), 1e-6);
    vec3 L = Lvec / dist;
    float NdotL = max(dot(N, L), 0.0);
    vec3 diffuse = kd * NdotL;
    vec3 R = reflect(-L, N);
    float RdotV = max(dot(R, V), 0.0);
    float spec = (NdotL > 0.0 && shin > 0.0) ? pow(RdotV, shin) : 0.0;
    vec3 specular = ks * spec;
    float atten = 1.0 / max(dist * dist, 1e-3);
    return (diffuse + specular) * lCol * atten;
  }

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(uCameraPos - vPosW);
    vec3 color = uMatAmbient * uMatDiffuse;
    color += shadePointLight(uPointLightColor, uPointLightPos, N, V, uMatDiffuse, uMatSpecular, uMatShininess);
    color = clamp(color, 0.0, 1.0);
    gl_FragColor = vec4(color, 1.0);
  }`;

  var mat = new BABYLON.ShaderMaterial("phongA", scene, "custom", {
    attributes: ["position", "normal"],
    uniforms: [
      "world","worldViewProjection","uCameraPos",
      "uMatAmbient","uMatDiffuse","uMatSpecular","uMatShininess",
      "uPointLightColor","uPointLightPos"
    ]
  });

  mat.setFloat ("uMatAmbient", 0.12);
  mat.setColor3("uMatDiffuse",  new BABYLON.Color3(0.80, 0.20, 0.20));
  mat.setColor3("uMatSpecular", new BABYLON.Color3(1.00, 1.00, 1.00));
  mat.setFloat ("uMatShininess", 64.0);
  mat.setColor3("uPointLightColor", new BABYLON.Color3(0.90, 0.95, 1.00));
  mat.setVector3("uPointLightPos",  new BABYLON.Vector3(2.0, 3.0, -1.0));

  mat.setVector3("uCameraPos", camera.position);
  scene.onBeforeRenderObservable.add(() => {
    mat.setVector3("uCameraPos", camera.position);
  });

  sphere.material = mat;
  cylinder.material = mat;

  return scene;
};
