import type { FoeKind } from "./foes";

export interface Level {
  bags: number;
  foes: number;
  foe: FoeKind;
  speed: number; // Karen chase speed, m/s
  chase: number; // distance at which a Karen notices you
  length: number; // corridor length, m
}

export const LEVELS: Level[] = [
  { bags: 5, foes: 2, foe: "easy", speed: 2.2, chase: 9, length: 50 },
  { bags: 7, foes: 3, foe: "easy", speed: 2.5, chase: 10, length: 58 },
  { bags: 8, foes: 3, foe: "mid", speed: 2.8, chase: 11, length: 62 },
  { bags: 9, foes: 4, foe: "mid", speed: 3.0, chase: 12, length: 68 },
  { bags: 10, foes: 4, foe: "hard", speed: 3.3, chase: 13, length: 72 },
  { bags: 11, foes: 5, foe: "hard", speed: 3.5, chase: 14, length: 78 },
  { bags: 12, foes: 6, foe: "hard", speed: 3.7, chase: 15, length: 84 },
];
