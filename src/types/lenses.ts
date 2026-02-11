export type ThielLensId = 'engineering' | 'timing' | 'monopoly' | 'people' | 'distribution' | 'durability' | 'secrets';

/** Generalized step ID — any string for framework-agnostic code */
export type LensId = string;

export const THIEL_LENS_ORDER: ThielLensId[] = [
    'engineering',
    'timing',
    'monopoly',
    'people',
    'distribution',
    'durability',
    'secrets',
];

/** @deprecated Use THIEL_LENS_ORDER for Thiel-specific code, or framework.stepOrder for generic code */
export const LENS_ORDER: ThielLensId[] = THIEL_LENS_ORDER;
