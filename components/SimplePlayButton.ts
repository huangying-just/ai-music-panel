/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PlaybackState } from '../types';

@customElement('simple-play-button')
export class SimplePlayButton extends LitElement {

  @property({ type: String }) playbackState: PlaybackState = 'stopped';

  static override styles = css`
    :host {
      display: inline-block;
    }
    
    button {
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
      position: relative;
    }
    
    button:hover {
      background: linear-gradient(145deg, #666, #444);
      transform: translateY(-1px);
      box-shadow: 
        0 6px 12px rgba(0,0,0,0.4),
        inset 0 1px 0 rgba(255,255,255,0.1);
    }
    
    button:active {
      transform: translateY(0);
      box-shadow: 
        0 2px 4px rgba(0,0,0,0.3),
        inset 0 1px 0 rgba(255,255,255,0.1);
    }
    
    .icon {
      color: #fff;
      font-size: 24px;
      line-height: 1;
    }
    
    .loading {
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;

  override render() {
    let icon = '';
    let className = 'icon';
    
    switch (this.playbackState) {
      case 'playing':
        icon = '⏸️'; // 暂停图标
        break;
      case 'loading':
        icon = '⏳'; // 加载图标
        className += ' loading';
        break;
      case 'paused':
      case 'stopped':
      default:
        icon = '▶️'; // 播放图标
        break;
    }

    return html`
      <button>
        <span class="${className}">${icon}</span>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'simple-play-button': SimplePlayButton
  }
} 