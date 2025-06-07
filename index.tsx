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
  { color: '#9900ff', text: 'Bossa Nova', displayText: '波萨诺瓦' },
  { color: '#5200ff', text: 'Synthwave', displayText: '电波音乐' },
  { color: '#ff25f6', text: 'Drum and Bass', displayText: '鼓打贝斯' },
  { color: '#2af6de', text: 'Post Punk', displayText: '后朋克' },
  { color: '#ffdd28', text: 'Shoegaze', displayText: '鞋履凝视' },
  { color: '#2af6de', text: 'Funk', displayText: '放克' },
  { color: '#9900ff', text: 'Chiptune', displayText: '芯片音乐' },
  { color: '#3dffab', text: 'Rich Strings', displayText: '丰富弦乐' },
  { color: '#d8ff3e', text: 'Sparkling Arpeggios', displayText: '闪亮琶音' },
  { color: '#d9b2ff', text: 'Staccato Beats', displayText: '断奏节拍' },
  { color: '#3dffab', text: 'Powerful Kick Drum', displayText: '有力底鼓' },
  { color: '#ffdd28', text: 'Disco', displayText: '迪斯科' },
  { color: '#ff25f6', text: 'K-POP', displayText: 'K-POP' },
  { color: '#d8ff3e', text: 'Neo Soul', displayText: '新灵魂乐' },
  { color: '#5200ff', text: 'Trance', displayText: '神游舞曲' },
  { color: '#d9b2ff', text: 'Thrash Metal', displayText: '激流金属' },
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
    
    .restart-button {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(145deg, #ff6b35, #e55a30);
      box-shadow: 
        0 3px 6px rgba(0,0,0,0.3),
        inset 0 1px 0 rgba(255,255,255,0.1);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      font-size: 16px;
      color: #fff;
    }
    
    .restart-button:disabled {
      background: linear-gradient(145deg, #666, #444);
      cursor: not-allowed;
      opacity: 0.5;
    }
    
    .record-button {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(145deg, #ff1744, #c51162);
      box-shadow: 
        0 4px 8px rgba(0,0,0,0.3),
        inset 0 1px 0 rgba(255,255,255,0.1);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      font-size: 18px;
      color: #fff;
      position: relative;
    }
    
    .record-button.recording {
      background: linear-gradient(145deg, #4caf50, #388e3c);
      animation: pulse-record 1.5s infinite;
    }
    
    .record-button:hover {
      transform: translateY(-1px);
      box-shadow: 
        0 6px 12px rgba(0,0,0,0.4),
        inset 0 1px 0 rgba(255,255,255,0.1);
    }
    
    .record-button:active {
      transform: translateY(0);
    }
    
    .record-duration {
      position: absolute;
      top: -25px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 10px;
      color: #fff;
      background: rgba(0,0,0,0.7);
      padding: 2px 6px;
      border-radius: 10px;
      white-space: nowrap;
    }
    
    @keyframes pulse-record {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
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
      
      .mobile-hint {
        display: block !important;
        margin-top: 5px;
      }
      
      #transport-controls {
        flex-wrap: wrap;
        gap: 15px;
      }
      
      .play-button {
        width: 50px;
        height: 50px;
        font-size: 20px;
      }
      
      .restart-button {
        width: 35px;
        height: 35px;
        font-size: 14px;
      }
    }
    
    @media only screen and (max-width: 480px) {
      prompt-controller {
        flex: 0 0 calc(100% - 0px);
      }
      #grid {
        gap: 8px;
        padding: 15px;
      }
      
      #console-container {
        padding: 15px;
        margin: 10px;
      }
      
      #transport-controls {
        padding: 15px;
        gap: 10px;
      }
      
      .play-button {
        width: 45px;
        height: 45px;
        font-size: 18px;
      }
      
      .restart-button {
        width: 30px;
        height: 30px;
        font-size: 12px;
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
  
  // Recording state
  @state() private isRecording = false;
  @state() private recordingDuration = 0;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingTimer: number | null = null;
  private recordingDestination: MediaStreamAudioDestinationNode | null = null;

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
    
    // Initialize recording destination
    this.recordingDestination = this.audioContext.createMediaStreamDestination();
    this.outputNode.connect(this.recordingDestination);
    
    // 设置初始音量
    this.outputNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
    this.updateAudioLevel = this.updateAudioLevel.bind(this);
    this.updateAudioLevel();
  }

  override async firstUpdated() {
    // 检测移动端设备
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      console.log('检测到移动端设备，已启用移动端优化');
      this.toastMessage.show('移动端用户：请点击播放按钮开始使用音频功能');
    }
    
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
    const allPrompts = Array.from(this.prompts.values());
    const filteredPrompts = allPrompts.filter((p) => {
      return !this.filteredPrompts.has(p.text) && p.weight !== 0;
    });
    
    console.log('所有提示权重状态:', allPrompts.map(p => `${p.text}=${p.weight}`).join(', '));
    console.log('过滤后发送的提示:', filteredPrompts.map(p => `${p.text}=${p.weight}`).join(', '));
    
    return filteredPrompts;
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
      const startTime = Date.now();
      
      // 强制重新开始音乐生成以应用新权重
      if (this.playbackState === 'playing') {
        console.log('强制重启音乐生成以应用新权重');
        await this.session.stop();
        this.nextStartTime = 0;
        
        // 稍等一下再重新开始
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.session.play();
      }
      
      await this.session.setWeightedPrompts({
        weightedPrompts: promptsToSend,
      });
      
      const endTime = Date.now();
      console.log(`成功发送权重提示到AI，耗时: ${endTime - startTime}ms`);
      console.log('发送的权重数据详情:', JSON.stringify(promptsToSend, null, 2));
    } catch (e) {
      console.error('发送权重提示失败:', e);
      this.toastMessage.show((e as Error).message)
      this.pause();
    }
  }, 300); // 增加节流时间以避免过于频繁的重启

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
    
    // 如果正在播放，强制重新开始音乐生成以应用新权重
    if (this.playbackState === 'playing') {
      console.log('强制刷新音乐生成以应用新权重');
      setTimeout(() => {
        this.nextStartTime = this.audioContext.currentTime + 0.5; // 短暂延迟后应用新权重
      }, 50);
    }
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
    // 移动端音频上下文激活
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('音频上下文已激活');
      } catch (e) {
        console.error('激活音频上下文失败:', e);
        this.toastMessage.show('无法启动音频，请检查浏览器权限');
        return;
      }
    }

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

  private async forceRestart() {
    if (this.playbackState !== 'playing') return;
    
    console.log('用户手动强制重启音乐生成');
    this.toastMessage.show('正在重启音乐生成以应用新权重...');
    
    try {
      // 停止当前播放
      await this.session.stop();
      this.nextStartTime = 0;
      this.playbackState = 'loading';
      
      // 等待一下
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 重新发送权重并开始播放
      await this.setSessionPrompts();
      await this.session.play();
      
      console.log('手动重启完成');
    } catch (e) {
      console.error('手动重启失败:', e);
      this.toastMessage.show('重启失败，请尝试重新播放');
      this.playbackState = 'stopped';
    }
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

  // Recording methods
  private async startRecording() {
    if (!this.recordingDestination) {
      this.toastMessage.show('录制功能初始化失败');
      return;
    }

    try {
      const stream = this.recordingDestination.stream;
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      this.recordedChunks = [];
      this.recordingDuration = 0;
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstop = () => {
        this.downloadRecording();
      };
      
      this.mediaRecorder.start();
      this.isRecording = true;
      
      // Start recording timer
      this.recordingTimer = window.setInterval(() => {
        this.recordingDuration++;
        this.requestUpdate();
      }, 1000);
      
      this.toastMessage.show('开始录制音乐...');
      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.toastMessage.show('录制启动失败');
    }
  }
  
  private stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      
      if (this.recordingTimer) {
        clearInterval(this.recordingTimer);
        this.recordingTimer = null;
      }
      
      console.log('Recording stopped');
    }
  }
  
  private downloadRecording() {
    if (this.recordedChunks.length === 0) {
      this.toastMessage.show('没有录制到音频数据');
      return;
    }
    
    const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    
    a.href = url;
    a.download = `ai-music-${timestamp}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.toastMessage.show(`录制完成！已下载 ${this.formatDuration(this.recordingDuration)} 的音频`);
    this.recordingDuration = 0;
  }
  
  private async toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      if (this.playbackState !== 'playing') {
        this.toastMessage.show('请先开始播放音乐再进行录制');
        return;
      }
      await this.startRecording();
    }
  }
  
  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
          <div class="mobile-hint" style="display: none; font-size: 12px; color: #888; text-align: center;">
            移动端提示：长按推子可调节音乐风格强度
          </div>
        </div>
        
        <div id="grid">${this.renderPrompts()}</div>
        
        <div id="transport-controls">
          <button 
            class="play-button ${this.playbackState}" 
            @click=${this.handlePlayPause}
            title=${this.playbackState === 'playing' ? '暂停' : '播放'}>
            ${this.getPlayButtonIcon()}
          </button>
          <button 
            class="restart-button" 
            @click=${this.forceRestart}
            title="强制重启以应用新权重"
            ?disabled=${this.playbackState !== 'playing'}>
            🔄
          </button>
          <button 
            class="record-button ${this.isRecording ? 'recording' : ''}" 
            @click=${this.toggleRecording}
            title=${this.isRecording ? '停止录制' : '开始录制音乐'}>
            ${this.isRecording ? '⏹️' : '🎙️'}
            ${this.isRecording ? html`<div class="record-duration">${this.formatDuration(this.recordingDuration)}</div>` : ''}
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
        displayText=${prompt.displayText || prompt.text}
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
    const { text, color, displayText } = prompt;
    prompts.set(promptId, {
      promptId,
      text,
      displayText,
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
