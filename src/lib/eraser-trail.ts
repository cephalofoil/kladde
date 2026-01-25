import getStroke from 'perfect-freehand';

interface TrailPoint {
  x: number;
  y: number;
  timestamp: number;
  pressure: number;
}

export class EraserTrail {
  private points: TrailPoint[] = [];
  private animationFrameId: number | null = null;
  private svgPath: SVGPathElement;
  private theme: 'light' | 'dark';
  private isActive = false;

  // Configuration based on Excalidraw
  private readonly streamline = 0.2;
  private readonly baseSize = 10;
  private readonly decayTime = 150; // milliseconds for trail to fully fade
  private readonly maxPoints = 100; // limit points for performance

  constructor(svgPath: SVGPathElement, theme: 'light' | 'dark' = 'light') {
    this.svgPath = svgPath;
    this.theme = theme;
    this.updatePathStyle();
  }

  private updatePathStyle(): void {
    // Semi-transparent overlay based on theme
    const color = this.theme === 'light'
      ? 'rgba(0, 0, 0, 0.2)'
      : 'rgba(255, 255, 255, 0.2)';

    this.svgPath.setAttribute('fill', color);
    this.svgPath.setAttribute('stroke', 'none');
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
    this.updatePathStyle();
  }

  startPath(x: number, y: number): void {
    this.isActive = true;
    this.points = [{
      x,
      y,
      timestamp: Date.now(),
      pressure: 1
    }];
    this.startAnimation();
  }

  addPoint(x: number, y: number): void {
    if (!this.isActive) return;

    const now = Date.now();
    this.points.push({
      x,
      y,
      timestamp: now,
      pressure: 1
    });

    // Limit points for performance
    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }
  }

  endPath(): void {
    this.isActive = false;
    // Let the animation continue to fade out the trail
  }

  clear(): void {
    this.isActive = false;
    this.points = [];
    this.svgPath.setAttribute('d', '');
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private startAnimation(): void {
    if (this.animationFrameId !== null) return;

    const animate = (): void => {
      this.render();
      this.animationFrameId = requestAnimationFrame(animate);

      // Stop animation if trail has fully decayed and is no longer active
      if (!this.isActive && this.points.length === 0) {
        this.clear();
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  private render(): void {
    const now = Date.now();

    // Remove old points that have fully decayed
    this.points = this.points.filter(point => {
      const age = now - point.timestamp;
      return age < this.decayTime;
    });

    if (this.points.length === 0) {
      this.svgPath.setAttribute('d', '');
      return;
    }

    // Apply decay to point sizes based on age
    const decayedPoints = this.points.map(point => {
      const age = now - point.timestamp;
      const decayFactor = this.easeOut(1 - (age / this.decayTime));

      return {
        x: point.x,
        y: point.y,
        pressure: decayFactor
      };
    });

    // Generate stroke using perfect-freehand with size mapping
    const stroke = getStroke(decayedPoints.map(p => [p.x, p.y, p.pressure]), {
      size: this.baseSize,
      smoothing: this.streamline,
      thinning: 0.5,
      streamline: this.streamline,
      easing: (t: number) => t,
      simulatePressure: false,
      last: !this.isActive,
    });

    // Convert stroke to SVG path
    const pathData = this.getSvgPathFromStroke(stroke);
    this.svgPath.setAttribute('d', pathData);
  }

  private easeOut(t: number): number {
    // Quadratic ease-out for smooth decay
    return t * (2 - t);
  }

  private getSvgPathFromStroke(stroke: number[][]): string {
    if (!stroke.length) return '';

    const d = stroke.reduce(
      (acc, [x0, y0], i, arr) => {
        const [x1, y1] = arr[(i + 1) % arr.length];
        acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
        return acc;
      },
      ['M', ...stroke[0], 'Q']
    );

    d.push('Z');
    return d.join(' ');
  }
}
