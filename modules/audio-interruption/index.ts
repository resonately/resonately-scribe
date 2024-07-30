import { NativeModulesProxy, EventEmitter, Subscription } from 'expo-modules-core';

// Import the native module. On web, it will be resolved to AudioInterruption.web.ts
// and on native platforms to AudioInterruption.ts
import AudioInterruptionModule from './src/AudioInterruptionModule';
import AudioInterruptionView from './src/AudioInterruptionView';
import { ChangeEventPayload, AudioInterruptionViewProps } from './src/AudioInterruption.types';

// Get the native constant value.
export const PI = AudioInterruptionModule.PI;

export function hello(): string {
  return AudioInterruptionModule.hello();
}

export async function setValueAsync(value: string) {
  return await AudioInterruptionModule.setValueAsync(value);
}

const emitter = new EventEmitter(AudioInterruptionModule ?? NativeModulesProxy.AudioInterruption);

export function addChangeListener(listener: (event: ChangeEventPayload) => void): Subscription {
  return emitter.addListener<ChangeEventPayload>('onChange', listener);
}

export async function startListeningForInterruption() {
  return await AudioInterruptionModule.startListeningForInterruption();
}

export function addInterruptionListener(listener: (event: { status: string; shouldResume?: boolean }) => void): Subscription {
  return emitter.addListener<{ status: string; shouldResume?: boolean }>('onInterruption', listener);
}

export { AudioInterruptionView, AudioInterruptionViewProps, ChangeEventPayload };
