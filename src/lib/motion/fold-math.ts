/**
 * Pure maths behind the foldable, kept apart from three.js so it can be unit tested.
 * Device space: the open device lies flat in the plane z = 0, hinge along x = 0, viewer on +z.
 */

export type V3 = { x: number; y: number; z: number };

/**
 * Screen parallax: where the ray from `eye` through `p` meets the plane z = `plane`.
 * The inner screen samples its image at that point, so the picture stays still from the
 * viewer's side while the hardware folds around it, and settles exactly in place once flat.
 */
export function projectToPlane(p: V3, eye: V3, plane: number): { x: number; y: number } {
  const t = (plane - eye.z) / (p.z - eye.z);
  return { x: eye.x + (p.x - eye.x) * t, y: eye.y + (p.y - eye.y) * t };
}

/**
 * Hinge on the left of the cover screen, opening like a book cover. `unfold` runs 0 (closed)
 * to 1 (flat). The front half turns about the hinge by `pivot` radians: π when closed (lying over
 * the back half), 0 when open (to the left of the hinge).
 */
export function hingeAngles(unfold: number) {
  const theta = unfold * Math.PI; // opening angle between the halves
  const pivot = Math.PI - theta;
  return {
    theta,
    pivot,
    /** x of the front half's outer edge (local x = -w) after turning. */
    outerEdgeX: (w: number) => -w * Math.cos(pivot),
    /** The spine half-cylinder faces outwards (-x) when closed and tucks behind (-z) when open. */
    spine: -unfold * (Math.PI / 2),
  };
}
