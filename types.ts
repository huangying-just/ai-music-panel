/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
export interface Prompt {
  readonly promptId: string;
  text: string;
  displayText?: string; // 界面显示的中文文本
  weight: number;
  cc: number;
  color: string;
}

export interface ControlChange {
  channel: number;
  cc: number;
  value: number;
}

export type PlaybackState = 'stopped' | 'playing' | 'loading' | 'paused';
