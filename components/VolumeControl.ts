/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

@customElement('volume-control')
export class VolumeControl extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px;
      background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
      border-radius: 8px;
      border: 1px solid #444;
      min-width: 200px;
    }
    
    .volume-icon {
      font-size: 18px;
      color: #fff;
      min-width: 20px;
    }
    
    .volume-slider-container {
      flex: 1;
      position: relative;
      height: 6px;
      background: #333;
      border-radius: 3px;
      cursor: pointer;
    }
    
    .volume-track {
      position: absolute;
      height: 100%;
      background: linear-gradient(90deg, #0f0 0%, #ff0 70%, #f00 100%);
      border-radius: 3px;
      transition: width 0.1s ease;
    }
    
    .volume-handle {
      position: absolute;
      top: 50%;
      width: 16px;
      height: 16px;
      background: linear-gradient(145deg, #fff, #ddd);
      border: 1px solid #999;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      cursor: grab;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    
    .volume-handle:hover {
      background: linear-gradient(145deg, #fff, #eee);
      transform: translate(-50%, -50%) scale(1.1);
    }
    
    .volume-handle:active {
      cursor: grabbing;
      transform: translate(-50%, -50%) scale(1.05);
    }
    
    .volume-value {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      color: #fff;
      min-width: 30px;
      text-align: right;
    }
    
    .mute-button {
      background: none;
      border: none;
      color: #fff;
      font-size: 16px;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: background 0.2s ease;
    }
    
    .mute-button:hover {
      background: rgba(255,255,255,0.1);
    }
    
    .mute-button.muted {
      color: #f44;
    }
  `;

  @property({ type: Number }) volume = 0.8;
  @property({ type: Boolean }) muted = false;

  private isDragging = false;
  private dragStartX = 0;
  private dragStartVolume = 0;

  constructor() {
    super();
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleSliderClick = this.handleSliderClick.bind(this);
  }

  private handlePointerDown(e: PointerEvent) {
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartVolume = this.volume;
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    e.preventDefault();
  }

  private handlePointerMove(e: PointerEvent) {
    if (!this.isDragging) return;
    
    const sliderElement = this.shadowRoot?.querySelector('.volume-slider-container') as HTMLElement;
    if (!sliderElement) return;
    
    const rect = sliderElement.getBoundingClientRect();
    const deltaX = e.clientX - this.dragStartX;
    const deltaPercent = deltaX / rect.width;
    
    this.volume = Math.max(0, Math.min(1, this.dragStartVolume + deltaPercent));
    this.dispatchVolumeChange();
  }

  private handlePointerUp() {
    this.isDragging = false;
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
  }

  private handleSliderClick(e: MouseEvent) {
    if (this.isDragging) return;
    
    const sliderElement = e.currentTarget as HTMLElement;
    const rect = sliderElement.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = clickX / rect.width;
    
    this.volume = Math.max(0, Math.min(1, percent));
    this.dispatchVolumeChange();
  }

  private toggleMute() {
    this.muted = !this.muted;
    this.dispatchVolumeChange();
  }

  private dispatchVolumeChange() {
    this.dispatchEvent(new CustomEvent('volume-change', {
      detail: { volume: this.volume, muted: this.muted }
    }));
  }

  override render() {
    const volumePercent = this.volume * 100;
    const effectiveVolume = this.muted ? 0 : this.volume;
    
    const trackStyle = styleMap({
      width: `${volumePercent}%`,
    });
    
    const handleStyle = styleMap({
      left: `${volumePercent}%`,
    });

    // 选择音量图标
    let volumeIcon = '🔊';
    if (this.muted || effectiveVolume === 0) {
      volumeIcon = '🔇';
    } else if (effectiveVolume < 0.3) {
      volumeIcon = '🔈';
    } else if (effectiveVolume < 0.7) {
      volumeIcon = '🔉';
    }

    return html`
      <button class="mute-button ${this.muted ? 'muted' : ''}" @click=${this.toggleMute}>
        ${volumeIcon}
      </button>
      <div class="volume-slider-container" @click=${this.handleSliderClick}>
        <div class="volume-track" style=${trackStyle}></div>
        <div 
          class="volume-handle" 
          style=${handleStyle}
          @pointerdown=${this.handlePointerDown}
        ></div>
      </div>
      <div class="volume-value">${Math.round(effectiveVolume * 100)}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'volume-control': VolumeControl;
  }
} 