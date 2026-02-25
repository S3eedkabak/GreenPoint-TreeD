/**
 * Validates tree height formula H = D × (tan(α) − tan(β)).
 * α = crown angle (treetop), β = base angle (tree base). Both in degrees from horizontal.
 */

function computeTreeHeight(D, alphaDeg, betaDeg) {
  if (D <= 0 || alphaDeg == null || betaDeg == null) return null;
  const α = (alphaDeg * Math.PI) / 180;
  const β = (betaDeg * Math.PI) / 180;
  return D * (Math.tan(α) - Math.tan(β));
}

function deg(rad) {
  return (rad * 180) / Math.PI;
}

function runTests() {
  let passed = 0;
  let failed = 0;

  function ok(cond, msg) {
    if (cond) {
      passed++;
      console.log('  OK: ' + msg);
    } else {
      failed++;
      console.log('  FAIL: ' + msg);
    }
  }

  function approx(a, b, tol = 0.001) {
    return Math.abs(a - b) <= tol;
  }

  console.log('Tree height formula tests\n');

  // H = D * (tan α - tan β). Example: D=20, α=30°, β=-5° → H = 20*(tan30 - tan(-5)) ≈ 20*(0.577 + 0.087) ≈ 13.28
  const H1 = computeTreeHeight(20, 30, -5);
  ok(H1 !== null && approx(H1, 13.28, 0.1), 'D=20, α=30°, β=-5° → H ≈ 13.3 m');

  // Base at horizon (β=0): H = D*tan(α)
  const H2 = computeTreeHeight(10, 45, 0);
  ok(H2 !== null && approx(H2, 10, 0.01), 'D=10, α=45°, β=0° → H = 10 m');

  // Both zero → H = 0
  const H3 = computeTreeHeight(15, 0, 0);
  ok(H3 !== null && approx(H3, 0, 0.01), 'D=15, α=0°, β=0° → H = 0');

  // β below horizon (negative) increases H
  const H4 = computeTreeHeight(20, 20, -10);
  ok(H4 !== null && H4 > 10, 'β = -10° (base below horizon) gives positive H');

  // D <= 0
  ok(computeTreeHeight(0, 20, -5) === null, 'D=0 returns null');
  ok(computeTreeHeight(-5, 20, -5) === null, 'D<0 returns null');

  // Missing angles
  ok(computeTreeHeight(10, null, -5) === null, 'α null returns null');
  ok(computeTreeHeight(10, 20, null) === null, 'β null returns null');

  // Base above crown (β > α) → tan β > tan α → H negative
  const H5 = computeTreeHeight(10, 5, 20);
  ok(H5 !== null && H5 < 0, 'β > α gives negative H (invalid aim order)');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
