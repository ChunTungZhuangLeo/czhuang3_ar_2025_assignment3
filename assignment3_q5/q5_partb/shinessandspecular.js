var createScene = function () {
    var scene = new BABYLON.Scene(engine);

    var ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 6, height: 6 }, scene);
    ground.isVisible = false;

    var camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);

    var sphere = BABYLON.MeshBuilder.CreateSphere("sphere", { diameter: 2, segments: 32 }, scene);
    sphere.position.y = 1;
    sphere.position.x = 1;

    var cylinder = BABYLON.MeshBuilder.CreateCylinder("cylinder", {height: 2, diameter: 1}, scene);
    cylinder.position.y = 1;
    cylinder.position.x = -1;

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
        vNormalW = normalize(mat3(world) * normal);
        gl_Position = worldViewProjection * vec4(position, 1.0);
    }`;

    BABYLON.Effect.ShadersStore["customFragmentShader"] = `
    precision highp float;
    varying vec3 vPosW;
    varying vec3 vNormalW;
    uniform float uMatAmbient;
    uniform vec3  uMatDiffuse;
    uniform vec3  uMatSpecular;
    uniform float uMatShininess;
    uniform vec3 uCameraPos;
    uniform vec3 uPointLightColor;
    uniform vec3 uPointLightPos;

    vec3 shadePointLight(
        vec3 lColor, vec3 lPos, vec3 N, vec3 V, vec3 kd, vec3 ks, float shin)
    {
        vec3 L = lPos - vPosW;
        float dist = max(length(L), 1e-6);
        L /= dist;
        float NdotL = max(dot(N, L), 0.0);
        vec3 diffuse = kd * NdotL;
        vec3 R = reflect(-L, N);
        float RdotV = max(dot(R, V), 0.0);
        float spec = (shin <= 0.0) ? 0.0 : pow(RdotV, shin);
        vec3 specular = ks * spec;
        float atten = 1.0 / max(dist * dist, 1e-3);
        return (diffuse + specular) * lColor * atten;
    }

    void main()
    {
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(uCameraPos - vPosW);
        vec3 color = uMatAmbient * uMatDiffuse;
        color += shadePointLight(
            uPointLightColor,
            uPointLightPos,
            N, V,
            uMatDiffuse, uMatSpecular, uMatShininess
        );
        gl_FragColor = vec4(color, 1.0);
    }`;

    var shaderMat = new BABYLON.ShaderMaterial("custom", scene, "custom", {
        attributes: ["position", "normal"],
        uniforms: [
            "world", "worldViewProjection",
            "uCameraPos",
            "uMatAmbient", "uMatDiffuse", "uMatSpecular", "uMatShininess",
            "uPointLightColor", "uPointLightPos"
        ]
    });

    shaderMat.setFloat("uMatAmbient", 0.15);
    shaderMat.setColor3("uMatDiffuse", new BABYLON.Color3(0.80, 0.20, 0.20));
    shaderMat.setColor3("uMatSpecular", new BABYLON.Color3(0.1, 0.1, 3));
    shaderMat.setFloat("uMatShininess", 1.0);
    shaderMat.setColor3("uPointLightColor", new BABYLON.Color3(0.7, 0.8, 1.0));
    shaderMat.setVector3("uPointLightPos", new BABYLON.Vector3(2.5, 4, -2.0));

    scene.onBeforeRenderObservable.add(function () {
        shaderMat.setVector3("uCameraPos", camera.position);
    });

    sphere.material = shaderMat;
    cylinder.material = shaderMat;

    return scene;
};
