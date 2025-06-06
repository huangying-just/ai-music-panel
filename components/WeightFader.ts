/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

/** 音乐控制台推子组件 */
@customElement('weight-fader')
export class WeightFader extends LitElement {
  static override styles = css`
    :host {
      cursor: grab;
      position: relative;
      width: 100%;
      height: 200px;
      display: flex;
      flex-direction: column;
      align-items: center;
      touch-action: none;
    }
    
    .fader-container {
      position: relative;
      width: 40px;
      height: 150px;
      background: linear-gradient(180deg, #333 0%, #111 100%);
      border-radius: 4px;
      border: 1px solid #555;
      margin-bottom: 8px;
    }
    
    .fader-track {
      position: absolute;
      left: 50%;
      top: 8px;
      bottom: 8px;
      width: 4px;
      background: #222;
      transform: translateX(-50%);
      border-radius: 2px;
    }
    
    .fader-fill {
      position: absolute;
      bottom: 0;
      width: 100%;
      border-radius: 2px;
      transition: height 0.1s ease;
    }
    
    .fader-handle {
      position: absolute;
      left: 50%;
      width: 32px;
      height: 16px;
      background: linear-gradient(180deg, #fff 0%, #ddd 100%);
      border: 1px solid #999;
      border-radius: 3px;
      transform: translateX(-50%);
      cursor: grab;
      transition: transform 0.1s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    
    .fader-handle:hover {
      background: linear-gradient(180deg, #fff 0%, #eee 100%);
    }
    
    .fader-handle:active {
      cursor: grabbing;
      transform: translateX(-50%) scale(1.05);
      box-shadow: 0 3px 6px rgba(0,0,0,0.4);
    }
    
    .fader-scale {
      position: absolute;
      left: -12px;
      top: 8px;
      bottom: 8px;
      width: 8px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-size: 8px;
      color: #888;
      font-family: monospace;
    }
    
    .scale-mark {
      height: 1px;
      background: #444;
      margin-right: 2px;
    }
    
    .level-indicator {
      position: absolute;
      right: -20px;
      top: 0;
      width: 8px;
      height: 100%;
      background: #111;
      border: 1px solid #444;
      border-radius: 2px;
    }
    
    .level-fill {
      position: absolute;
      bottom: 0;
      width: 100%;
      background: linear-gradient(0deg, #0f0 0%, #ff0 70%, #f00 100%);
      border-radius: 1px;
      transition: height 0.05s ease;
    }
    
    .value-display {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 10px;
      color: #fff;
      text-align: center;
      margin-bottom: 4px;
      min-height: 12px;
    }
  `;

  @property({ type: Number }) value = 0;
  @property({ type: String }) color = '#000';
  @property({ type: Number }) audioLevel = 0;

  private dragStartPos = 0;
  private dragStartValue = 0;
  private isDragging = false;

  constructor() {
    super();
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
  }

  private handlePointerDown(e: PointerEvent) {
    this.isDragging = true;
    this.dragStartPos = e.clientY;
    this.dragStartValue = this.value;
    document.body.classList.add('dragging');
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    e.preventDefault();
  }

  private handlePointerMove(e: PointerEvent) {
    if (!this.isDragging) return;
    
    const containerHeight = 134; // 150px - 16px padding
    const delta = this.dragStartPos - e.clientY;
    const valueChange = (delta / containerHeight) * 2;
    
    this.value = Math.max(0, Math.min(2, this.dragStartValue + valueChange));
    this.dispatchEvent(new CustomEvent<number>('input', { detail: this.value }));
  }

  private handlePointerUp(e: PointerEvent) {
    this.isDragging = false;
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    document.body.classList.remove('dragging');
  }

  private handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY;
    this.value = Math.max(0, Math.min(2, this.value + delta * -0.005));
    this.dispatchEvent(new CustomEvent<number>('input', { detail: this.value }));
  }

  override render() {
    const valuePercent = (this.value / 2) * 100;
    const handleTop = 150 - 16 - (valuePercent / 100) * 134; // 150px container - 16px handle - track
    const levelPercent = Math.min(100, this.audioLevel * 100);
    
    const fillStyle = styleMap({
      background: this.color,
      height: `${valuePercent}%`,
    });
    
    const handleStyle = styleMap({
      top: `${handleTop}px`,
    });
    
    const levelStyle = styleMap({
      height: `${levelPercent}%`,
    });

    return html`
      <div class="value-display">${Math.round(this.value * 50)}</div>
      <div class="fader-container" @wheel=${this.handleWheel}>
        <div class="fader-scale">
          <div class="scale-mark"></div>
          <div class="scale-mark"></div>
          <div class="scale-mark"></div>
          <div class="scale-mark"></div>
          <div class="scale-mark"></div>
        </div>
        <div class="fader-track">
          <div class="fader-fill" style=${fillStyle}></div>
        </div>
        <div 
          class="fader-handle" 
          style=${handleStyle}
          @pointerdown=${this.handlePointerDown}
        ></div>
        <div class="level-indicator">
          <div class="level-fill" style=${levelStyle}></div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'weight-fader': WeightFader;
  }
} 