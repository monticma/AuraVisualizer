// ============================================
// AURA MMORPG - Main Entry Point
// ============================================

import "./style.css";
import { Game } from "./Game";

// Initialize game when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const game = new Game("gameCanvas");
  game.start();

  // Expose to console for debugging
  (window as any).game = game;
});
