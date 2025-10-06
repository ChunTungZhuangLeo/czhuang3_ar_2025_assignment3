var createScene = async function () {
    var scene = new BABYLON.Scene(engine);
    var camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, -5), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);

    const arAvailable = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync('immersive-ar');
    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("FullscreenUI");

    const infoPanel = new BABYLON.GUI.Rectangle("infoPanel");
    infoPanel.background = "#1a1a2e";
    infoPanel.color = "#16213e";
    infoPanel.width = "75%";
    infoPanel.height = "55%";
    infoPanel.cornerRadius = 20;
    infoPanel.thickness = 3;

    advancedTexture.addControl(infoPanel);
    const contentStack = new BABYLON.GUI.StackPanel();
    infoPanel.addControl(contentStack);

    const instructionText = new BABYLON.GUI.TextBlock("instructions");
    instructionText.fontFamily = "Arial";
    instructionText.textWrapping = true;
    instructionText.color = "#eaf2f8";
    instructionText.fontSize = "16px";
    instructionText.height = "450px";
    instructionText.paddingLeft = "15px";
    instructionText.paddingRight = "15px";
    instructionText.paddingTop = "20px";
 
    if (!arAvailable) {
        instructionText.text = "not avaialble";
        contentStack.addControl(instructionText);
        return scene;
    } else {
        instructionText.text = "ok let's go";
        contentStack.addControl(instructionText);
    }

    const ambientLight = new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.6;

    const directionalLight = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(0, -1, -0.5), scene);
    directionalLight.position = new BABYLON.Vector3(0, 5, -5);
    directionalLight.intensity = 0.8;

    const shadows = new BABYLON.ShadowGenerator(2048, directionalLight);
    shadows.useBlurExponentialShadowMap = true;
    shadows.blurKernel = 64;

    const modelData = await BABYLON.SceneLoader.ImportMeshAsync(
        "", 
        "https://cdn.jsdelivr.net/gh/ChunTungZhuangLeo/greenHack@main/", 
        "wilson_blade_team_tennis_racket.glb", 
        scene
    );
    
    const baseModel = modelData.meshes[0];
    baseModel.rotationQuaternion = new BABYLON.Quaternion();
    baseModel.scaling = new BABYLON.Vector3(0.1, 0.1, 0.1);
    baseModel.isVisible = false;
    shadows.addShadowCaster(baseModel, true);

    const xrHelper = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
            sessionMode: 'immersive-ar'
        },
        optionalFeatures: true
    });

    xrHelper.baseExperience.sessionManager.onXRSessionInit.add(() => {
        infoPanel.isVisible = false;
    });
    
    xrHelper.baseExperience.sessionManager.onXRSessionEnded.add(() => {
        infoPanel.isVisible = true;
    });

    const featureManager = xrHelper.baseExperience.featuresManager;
    featureManager.enableFeature(BABYLON.WebXRBackgroundRemover.Name);

    featureManager.enableFeature(
        BABYLON.WebXRFeatureName.DEPTH_SENSING,
        "latest",
        {
            dataFormatPreference: ["ushort", "float"],
            usagePreference: ["cpu", "gpu"],
        }
    );

    const placementRing = BABYLON.MeshBuilder.CreateTorus('placementRing', { 
        diameter: 0.2, 
        thickness: 0.04,
        tessellation: 32
    }, scene);
    placementRing.isVisible = false;
    placementRing.rotationQuaternion = new BABYLON.Quaternion();
    
    const ringMaterial = new BABYLON.StandardMaterial("ringMat", scene);
    ringMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.8, 1);
    placementRing.material = ringMaterial;

    let hitSource = null;
    let activeHitResult = null;
    let placedModels = [];
    let currentlySelected = null;

    xrHelper.input.onControllerAddedObservable.add(async (inputController) => {
        inputController.onMotionControllerInitObservable.add((motionCtrl) => {
            if (motionCtrl.handedness === 'right') {
                const componentIDs = motionCtrl.getComponentIds();
                const xrSession = xrHelper.baseExperience.sessionManager.session;
                const referenceSpace = xrHelper.baseExperience.sessionManager.referenceSpace;

                xrSession.requestHitTestSource({
                    space: inputController.inputSource.targetRaySpace,
                }).then((testSource) => {
                    hitSource = testSource;
                });

                xrHelper.baseExperience.sessionManager.onXRFrameObservable.add((frame) => {
                    if (hitSource) {
                        const hitResults = frame.getHitTestResults(hitSource);
                        
                        if (hitResults.length > 0) {
                            placementRing.isVisible = true;
                            activeHitResult = hitResults[0];
                            
                            const resultPose = hitResults[0].getPose(referenceSpace);
                            const pos = resultPose.transform.position;
                            const rot = resultPose.transform.orientation;
                            
                            placementRing.position.set(pos.x, pos.y, -pos.z);
                            placementRing.rotationQuaternion.set(rot.x, rot.y, rot.z, rot.w);
                        } else {
                            placementRing.isVisible = false;
                            activeHitResult = null;
                        }
                    }
                });
                
                const triggerButton = motionCtrl.getComponent(componentIDs[0]);
                if (triggerButton) {
                    triggerButton.onButtonStateChangedObservable.add(() => {
                        if (triggerButton.pressed && activeHitResult && xrHelper.baseExperience.state === BABYLON.WebXRState.IN_XR) {
                            const spawnPose = activeHitResult.getPose(referenceSpace);
                            
                            if (spawnPose) {
                                const instanceModel = baseModel.clone("model_" + placedModels.length);
                                instanceModel.isVisible = true;
                                
                                const spawnPos = spawnPose.transform.position;
                                const spawnRot = spawnPose.transform.orientation;
                                
                                instanceModel.position.set(spawnPos.x, spawnPos.y, -spawnPos.z);
                                instanceModel.rotationQuaternion.set(spawnRot.x, spawnRot.y, spawnRot.z, spawnRot.w);
                                
                                shadows.addShadowCaster(instanceModel, true);
                                placedModels.push(instanceModel);
                                currentlySelected = instanceModel;
                                
                                console.log("Spawned at:", instanceModel.position);
                            }
                        }
                    });
                }

                const thumbstick = motionCtrl.getComponent(componentIDs[2]);
                let stickAxes = { x: 0, y: 0 };
                
                if (thumbstick) {
                    thumbstick.onAxisValueChangedObservable.add((axisValues) => {
                        stickAxes.x = axisValues.x;
                        stickAxes.y = axisValues.y;
                    });
                }
                
                scene.onBeforeRenderObservable.add(() => {
                    if (currentlySelected && currentlySelected.isVisible) {
                        const threshold = 0.15;
                        if (Math.abs(stickAxes.x) > threshold || Math.abs(stickAxes.y) > threshold) {
                            const speed = 0.003;
                            
                            const viewRotation = xrHelper.baseExperience.camera.rotationQuaternion || BABYLON.Quaternion.Identity();
                            
                            const forwardDir = new BABYLON.Vector3();
                            const rightDir = new BABYLON.Vector3();
                            new BABYLON.Vector3(0, 0, 1).rotateByQuaternionToRef(viewRotation, forwardDir);
                            new BABYLON.Vector3(1, 0, 0).rotateByQuaternionToRef(viewRotation, rightDir);
                            
                            forwardDir.y = 0;
                            rightDir.y = 0;
                            forwardDir.normalize();
                            rightDir.normalize();
                            
                            const deltaMove = new BABYLON.Vector3(
                                rightDir.x * stickAxes.x * speed + forwardDir.x * (-stickAxes.y) * speed,
                                0,
                                rightDir.z * stickAxes.x * speed + forwardDir.z * (-stickAxes.y) * speed
                            );
                            
                            currentlySelected.position.addInPlace(deltaMove);
                        }
                    }
                });
            }
        });
    });

    return scene;
};
