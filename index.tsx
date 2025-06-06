/**
 * @fileoverview Control real time music with a MIDI controller
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, LitElement } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import { GoogleGenAI, type LiveMusicSession, type LiveMusicServerMessage } from '@google/genai';

import { decode, decodeAudioData } from './utils/audio'
import { throttle } from './utils/throttle'
import { AudioAnalyser } from './utils/AudioAnalyser';
import { MidiDispatcher } from './utils/MidiDispatcher';

import './components/WeightKnob';
import './components/WeightFader';
import './components/VolumeControl';
import './components/PromptController';
import { PlayPauseButton } from './components/PlayPauseButton';
import { SimplePlayButton } from './components/SimplePlayButton';
import { ToastMessage } from './components/ToastMessage';

import type { Prompt, PlaybackState } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: 'v1alpha' });
const model = 'lyria-realtime-exp';

const DEFAULT_PROMPTS = [
  { color: '#9900ff', text: '波萨诺瓦' },
  { color: '#5200ff', text: '电波音乐' },
  { color: '#ff25f6', text: '鼓打贝斯' },
  { color: '#2af6de', text: '后朋克' },
  { color: '#ffdd28', text: '鞋鞋凝视' },
  { color: '#2af6de', text: '放克' },
  { color: '#9900ff', text: '芯片音乐' },
  { color: '#3dffab', text: '丰富弦乐' },
  { color: '#d8ff3e', text: '闪亮琶音' },
  { color: '#d9b2ff', text: '断奏节拍' },
  { color: '#3dffab', text: '有力底鼓' },
  { color: '#ffdd28', text: '迪斯科舞曲' },
  { color: '#ff25f6', text: 'K-POP' },
  { color: '#d8ff3e', text: '新灵魂乐' },
  { color: '#5200ff', text: '神游舞曲' },
  { color: '#d9b2ff', text: '激流金属' },
];

/** The grid of prompt inputs. */
@customElement('prompt-dj-midi')
class PromptDjMidi extends LitElement {
  static override styles = css`
    :host {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      box-sizing: border-box;
      position: relative;
      padding: 20px;
      background: linear-gradient(145deg, #1a1a1a, #0a0a0a);
    }
    
    #background {
      will-change: background-image;
      position: absolute;
      height: 100%;
      width: 100%;
      z-index: -1;
      background: linear-gradient(145deg, #1a1a1a, #0a0a0a);
    }
    
    #console-container {
      width: 100%;
      max-width: 1200px;
      background: linear-gradient(145deg, #333, #222);
      border-radius: 12px;
      padding: 20px;
      box-shadow: 
        0 8px 32px rgba(0,0,0,0.5),
        inset 0 1px 0 rgba(255,255,255,0.1);
      border: 1px solid #444;
    }
    
    #console-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid #444;
    }
    
    #console-title {
      color: #fff;
      font-size: 18px;
      font-weight: 600;
      margin: 0;
    }
    
    #grid {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
      margin-bottom: 20px;
      padding: 20px;
      background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
      border-radius: 8px;
      border: 1px solid #444;
    }
    
    prompt-controller {
      flex: 0 0 calc(25% - 9px);
      min-width: 80px;
      max-width: 120px;
    }
    
    #transport-controls {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 20px;
      padding: 20px;
      background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
      border-radius: 8px;
      border: 1px solid #444;
    }
    
    .play-button {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(145deg, #555, #333);
      box-shadow: 
        0 4px 8px rgba(0,0,0,0.3),
        inset 0 1px 0 rgba(255,255,255,0.1);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      font-size: 24px;
      color: #fff;
    }
    
    .play-button:hover {
      background: linear-gradient(145deg, #666, #444);
      transform: translateY(-1px);
      box-shadow: 
        0 6px 12px rgba(0,0,0,0.4),
        inset 0 1px 0 rgba(255,255,255,0.1);
    }
    
    .play-button:active {
      transform: translateY(0);
      box-shadow: 
        0 2px 4px rgba(0,0,0,0.3),
        inset 0 1px 0 rgba(255,255,255,0.1);
    }
    
    .play-button.loading {
      animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    
    #buttons {
      position: absolute;
      top: 20px;
      right: 20px;
      display: flex;
      gap: 8px;
      z-index: 100;
    }
    
    button {
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      color: #fff;
      background: linear-gradient(145deg, #444, #333);
      -webkit-font-smoothing: antialiased;
      border: 1px solid #666;
      border-radius: 6px;
      user-select: none;
      padding: 6px 12px;
      transition: all 0.2s ease;
      &.active {
        background: linear-gradient(145deg, #555, #444);
        color: #fff;
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
      }
      &:hover {
        background: linear-gradient(145deg, #555, #444);
      }
    }
    
    select {
      font: inherit;
      padding: 6px 8px;
      background: linear-gradient(145deg, #444, #333);
      color: #fff;
      border-radius: 6px;
      border: 1px solid #666;
      outline: none;
      cursor: pointer;
    }
    
    @media only screen and (max-width: 768px) {
      prompt-controller {
        flex: 0 0 calc(50% - 6px);
      }
    }
    
    @media only screen and (max-width: 480px) {
      prompt-controller {
        flex: 0 0 calc(100% - 0px);
      }
      #grid {
        gap: 8px;
      }
    }
  `;

  private prompts: Map<string, Prompt>;
  private midiDispatcher: MidiDispatcher;
  private audioAnalyser: AudioAnalyser;

  @state() private playbackState: PlaybackState = 'stopped';

  private session: LiveMusicSession;
  private audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
  private outputNode: GainNode = this.audioContext.createGain();
  private nextStartTime = 0;
  private readonly bufferTime = 2; // adds an audio buffer in case of netowrk latency

  @property({ type: Boolean }) private showMidi = false;
  @state() private audioLevel = 0;
  @state() private midiInputIds: string[] = [];
  @state() private activeMidiInputId: string | null = null;
  @state() private volume = 0.8;
  @state() private muted = false;

  @property({ type: Object })
  private filteredPrompts = new Set<string>();

  private audioLevelRafId: number | null = null;
  private connectionError = true;

  @query('play-pause-button') private playPauseButton!: PlayPauseButton;
  @query('toast-message') private toastMessage!: ToastMessage;

  constructor(
    prompts: Map<string, Prompt>,
    midiDispatcher: MidiDispatcher,
  ) {
    super();
    this.prompts = prompts;
    this.midiDispatcher = midiDispatcher;
    this.audioAnalyser = new AudioAnalyser(this.audioContext);
    this.audioAnalyser.node.connect(this.audioContext.destination);
    this.outputNode.connect(this.audioAnalyser.node);
    // 设置初始音量
    this.outputNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
    this.updateAudioLevel = this.updateAudioLevel.bind(this);
    this.updateAudioLevel();
  }

  override async firstUpdated() {
    await this.connectToSession();
    await this.setSessionPrompts();
  }

  private async connectToSession() {
    this.session = await ai.live.music.connect({
      model: model,
      callbacks: {
        onmessage: async (e: LiveMusicServerMessage) => {
          if (e.setupComplete) {
            this.connectionError = false;
          }
          if (e.filteredPrompt) {
            this.filteredPrompts = new Set([...this.filteredPrompts, e.filteredPrompt.text])
            this.toastMessage.show(e.filteredPrompt.filteredReason);
          }
          if (e.serverContent?.audioChunks !== undefined) {
            if (this.playbackState === 'paused' || this.playbackState === 'stopped') return;
            const audioBuffer = await decodeAudioData(
              decode(e.serverContent?.audioChunks[0].data),
              this.audioContext,
              48000,
              2,
            );
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.outputNode);
            if (this.nextStartTime === 0) {
              this.nextStartTime = this.audioContext.currentTime + this.bufferTime;
              setTimeout(() => {
                this.playbackState = 'playing';
              }, this.bufferTime * 1000);
            }

            if (this.nextStartTime < this.audioContext.currentTime) {
              this.playbackState = 'loading';
              this.nextStartTime = 0;
              return;
            }
            source.start(this.nextStartTime);
            this.nextStartTime += audioBuffer.duration;
          }
        },
        onerror: (e: ErrorEvent) => {
          this.connectionError = true;
          this.stop();
          this.toastMessage.show('Connection error, please restart audio.');
        },
        onclose: (e: CloseEvent) => {
          this.connectionError = true;
          this.stop();
          this.toastMessage.show('Connection error, please restart audio.');
        },
      },
    });
  }

  private getPromptsToSend() {
    return Array.from(this.prompts.values())
      .filter((p) => {
        return !this.filteredPrompts.has(p.text) && p.weight !== 0;
      })
  }

  private setSessionPrompts = throttle(async () => {
    const promptsToSend = this.getPromptsToSend();
    console.log(`发送权重提示到AI: `, promptsToSend.map(p => `${p.text}=${p.weight}`).join(', '));
    if (promptsToSend.length === 0) {
      this.toastMessage.show('There needs to be one active prompt to play.')
      this.pause();
      return;
    }
    try {
      await this.session.setWeightedPrompts({
        weightedPrompts: promptsToSend,
      });
      console.log('成功发送权重提示到AI');
    } catch (e) {
      console.error('发送权重提示失败:', e);
      this.toastMessage.show((e as Error).message)
      this.pause();
    }
  }, 200);

  private updateAudioLevel() {
    this.audioLevelRafId = requestAnimationFrame(this.updateAudioLevel);
    this.audioLevel = this.audioAnalyser.getCurrentLevel();
  }

  private dispatchPromptsChange() {
    this.dispatchEvent(
      new CustomEvent('prompts-changed', { detail: this.prompts }),
    );
    return this.setSessionPrompts();
  }

  private handlePromptChanged(e: CustomEvent<Prompt>) {
    const { promptId, text, weight, cc } = e.detail;
    console.log(`主应用接收权重变更: ${text} = ${weight}`);
    const prompt = this.prompts.get(promptId);

    if (!prompt) {
      console.error('未找到提示', promptId);
      return;
    }

    prompt.text = text;
    prompt.weight = weight;
    prompt.cc = cc;

    const newPrompts = new Map(this.prompts);
    newPrompts.set(promptId, prompt);

    this.setPrompts(newPrompts);
  }

  private setPrompts(newPrompts: Map<string, Prompt>) {
    this.prompts = newPrompts;
    this.requestUpdate();
    this.dispatchPromptsChange();
  }

  /** Generates radial gradients for each prompt based on weight and color. */
  private readonly makeBackground = throttle(
    () => {
      const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

      const MAX_WEIGHT = 0.5;
      const MAX_ALPHA = 0.6;

      const bg: string[] = [];

      [...this.prompts.values()].forEach((p, i) => {
        const alphaPct = clamp01(p.weight / MAX_WEIGHT) * MAX_ALPHA;
        const alpha = Math.round(alphaPct * 0xff)
          .toString(16)
          .padStart(2, '0');

        const stop = p.weight / 2;
        const x = (i % 4) / 3;
        const y = Math.floor(i / 4) / 3;
        const s = `radial-gradient(circle at ${x * 100}% ${y * 100}%, ${p.color}${alpha} 0px, ${p.color}00 ${stop * 100}%)`;

        bg.push(s);
      });

      return bg.join(', ');
    },
    30, // don't re-render more than once every XXms
  );

  private pause() {
    this.session.pause();
    this.playbackState = 'paused';
    this.outputNode.gain.setValueAtTime(1, this.audioContext.currentTime);
    this.outputNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.1);
    this.nextStartTime = 0;
    this.outputNode = this.audioContext.createGain();
    this.outputNode.connect(this.audioContext.destination);
    this.outputNode.connect(this.audioAnalyser.node);
  }

  private play() {

    const promptsToSend = this.getPromptsToSend();
    if (promptsToSend.length === 0) {
      this.toastMessage.show('需要至少一个激活的音乐提示才能播放。调高一个旋钮来恢复播放。')
      this.pause();
      return;
    }

    this.audioContext.resume();
    this.session.play();
    this.playbackState = 'loading';
    this.outputNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    this.outputNode.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + 0.1);
  }

  private stop() {
    this.session.stop();
    this.playbackState = 'stopped';
    this.outputNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    this.outputNode.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + 0.1);
    this.nextStartTime = 0;
  }

  private async handlePlayPause() {
    if (this.playbackState === 'playing') {
      this.pause();
    } else if (this.playbackState === 'paused' || this.playbackState === 'stopped') {
      if (this.connectionError) {
        await this.connectToSession();
        this.setSessionPrompts();
      }
      this.play();
    } else if (this.playbackState === 'loading') {
      this.stop();
    }
    console.debug('处理播放暂停');
  }

  private async toggleShowMidi() {
    this.showMidi = !this.showMidi;
    if (!this.showMidi) return;
    const inputIds = await this.midiDispatcher.getMidiAccess();
    this.midiInputIds = inputIds;
    this.activeMidiInputId = this.midiDispatcher.activeMidiInputId;
  }

  private handleMidiInputChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const newMidiId = selectElement.value;
    this.activeMidiInputId = newMidiId;
    this.midiDispatcher.activeMidiInputId = newMidiId;
  }

  private resetAll() {
    this.setPrompts(buildDefaultPrompts());
  }

  private handleVolumeChange(e: CustomEvent) {
    const { volume, muted } = e.detail;
    this.volume = volume;
    this.muted = muted;
    // 应用音量到音频输出
    const effectiveVolume = muted ? 0 : volume;
    this.outputNode.gain.setValueAtTime(effectiveVolume, this.audioContext.currentTime);
  }

  private getPlayButtonIcon() {
    switch (this.playbackState) {
      case 'playing':
        return '⏸️'; // 暂停
      case 'loading':
        return '⏳'; // 加载中
      case 'paused':
      case 'stopped':
      default:
        return '▶️'; // 播放
    }
  }

  override render() {
    const bg = styleMap({
      backgroundImage: this.makeBackground(),
    });
    return html`
      <div id="background" style=${bg}></div>
      <div id="buttons">
        <button
          @click=${this.toggleShowMidi}
          class=${this.showMidi ? 'active' : ''}
          >MIDI 控制器</button
        >
        <select
          @change=${this.handleMidiInputChange}
          .value=${this.activeMidiInputId || ''}
          style=${this.showMidi ? '' : 'visibility: hidden'}>
          ${this.midiInputIds.length > 0
        ? this.midiInputIds.map(
          (id) =>
            html`<option value=${id}>
                    ${this.midiDispatcher.getDeviceName(id)}
                  </option>`,
        )
        : html`<option value="">未找到设备</option>`}
        </select>
      </div>
      
      <div id="console-container">
        <div id="console-header">
          <h1 id="console-title">🎵 AI 音乐控制台</h1>
        </div>
        
        <div id="grid">${this.renderPrompts()}</div>
        
        <div id="transport-controls">
          <button 
            class="play-button ${this.playbackState}" 
            @click=${this.handlePlayPause}
            title=${this.playbackState === 'playing' ? '暂停' : '播放'}>
            ${this.getPlayButtonIcon()}
          </button>
          <volume-control 
            .volume=${this.volume} 
            .muted=${this.muted}
            @volume-change=${this.handleVolumeChange}>
          </volume-control>
        </div>
      </div>
      
      <toast-message></toast-message>
    `;
  }

  private renderPrompts() {
    return [...this.prompts.values()].map((prompt) => {
      return html`<prompt-controller
        promptId=${prompt.promptId}
        filtered=${this.filteredPrompts.has(prompt.text)}
        cc=${prompt.cc}
        text=${prompt.text}
        weight=${prompt.weight}
        color=${prompt.color}
        .midiDispatcher=${this.midiDispatcher}
        .showCC=${this.showMidi}
        audioLevel=${this.audioLevel}
        @prompt-changed=${this.handlePromptChanged}>
      </prompt-controller>`;
    });
  }
}

function main(parent: HTMLElement) {
  const midiDispatcher = new MidiDispatcher();
  const initialPrompts = getInitialPrompts();
  const pdjMidi = new PromptDjMidi(
    initialPrompts,
    midiDispatcher,
  );
  parent.appendChild(pdjMidi);
}

function getInitialPrompts(): Map<string, Prompt> {
  const { localStorage } = window;
  const storedPrompts = localStorage.getItem('prompts');

  if (storedPrompts) {
    try {
      const prompts = JSON.parse(storedPrompts) as Prompt[];
      console.log('加载已存储的提示', prompts);
      return new Map(prompts.map((prompt) => [prompt.promptId, prompt]));
    } catch (e) {
      console.error('解析已存储的提示失败', e);
    }
  }

  console.log('没有已存储的提示，使用默认提示');

  return buildDefaultPrompts();
}

function buildDefaultPrompts() {
  // Construct default prompts
  // Pick 3 random prompts to start with weight 1
  const startOn = [...DEFAULT_PROMPTS]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const prompts = new Map<string, Prompt>();

  for (let i = 0; i < DEFAULT_PROMPTS.length; i++) {
    const promptId = `prompt-${i}`;
    const prompt = DEFAULT_PROMPTS[i];
    const { text, color } = prompt;
    prompts.set(promptId, {
      promptId,
      text,
      weight: startOn.includes(prompt) ? 1 : 0,
      cc: i,
      color,
    });
  }

  return prompts;
}

function setStoredPrompts(prompts: Map<string, Prompt>) {
  const storedPrompts = JSON.stringify([...prompts.values()]);
  const { localStorage } = window;
  localStorage.setItem('prompts', storedPrompts);
}

main(document.body);
