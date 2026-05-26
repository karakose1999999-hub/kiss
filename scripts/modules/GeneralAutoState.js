function createGeneralAutoDefaultSettings() {
    return {
        manualStopped: { spin: false, kiss: false, close: false },
        retList: {},
        lowScoreRetEnabled: false,
        lowScoreRetThreshold: 5000,
        forceRetAll: false,
        guardEnabled: false,
        performance: createGeneralAutoPerformanceDefaults()
    };
}

function createGeneralAutoFeatures(ctx, requestRender) {
    return [
        createGeneralAutoSpinFeature(ctx, requestRender),
        createGeneralAutoKissFeature(ctx, requestRender),
        createGeneralAutoCloseFeature(ctx, requestRender),
        createGeneralAutoGuardFeature(ctx, requestRender),
        createGeneralAutoPerformanceFeature(ctx, requestRender)
    ].filter(feature => ctx.featureVisible(feature.key));
}
