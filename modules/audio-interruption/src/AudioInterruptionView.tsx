import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';

import { AudioInterruptionViewProps } from './AudioInterruption.types';

const NativeView: React.ComponentType<AudioInterruptionViewProps> =
  requireNativeViewManager('AudioInterruption');

export default function AudioInterruptionView(props: AudioInterruptionViewProps) {
  return <NativeView {...props} />;
}
