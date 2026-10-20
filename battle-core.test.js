const assert = require('node:assert/strict');
const fs = require('node:fs');
const core = require('./battle-core.js').PlakoroBattleCore;

function run(effect, overrides = {}) {
  const move = Object.assign({ damage: 10 }, overrides.move || {});
  move.effects = [effect];
  const ctx = Object.assign({
    move,
    own: {},
    targetEffects: {},
    notes: [],
    damage: 10,
    damageParts: [10],
    heal: 0,
    selfDamage: 0,
    failed: false,
    roll: [['불꽃'], ['물']],
    counts: { 불꽃: 1, 물: 1 },
    posture: '정방향',
    ownerHp: 120,
    ownerFailed: false,
    targetFailed: false,
    randomPose: () => '뒤로',
    chooseBlockedMove: () => ({ id: 'blocked-id', name: '봉쇄 기술' }),
    rollOpponent: () => [['물'], ['물', '불꽃'], ['물']],
    rollExtra: () => [['불꽃']],
    getTargetLastMove: () => ({ damage: 30 })
  }, overrides);
  ctx.move = move;
  return { result: core.applyMoveEffects(ctx), ctx };
}

assert.deepEqual(core.rollCounts([['불꽃', '물'], ['물']]), { 불꽃: 1, 물: 2 });
assert.equal(core.canPay({ 불꽃: 1, 무색: 1 }, [['불꽃'], ['물']]), true);
assert.equal(core.canPay({ 불꽃: 2 }, [['불꽃'], ['물']]), false);
assert.equal(core.diceCount(3, -2), 1);
assert.equal(core.diceCount(3, 20), 6);
assert.equal(core.validateMove('a', 'a', null).reason, 'repeat');
assert.equal(core.validateMove('a', null, 'a').reason, 'blocked');
assert.equal(core.validateMove('a', null, null).ok, true);
assert.deepEqual(core.poseInfo('물구나무'), ['🔄', '물구나무']);

{
  const mewMoves = [
    { name: '염동력', damage: 10, value: 20, poses: ['정방향', '물구나무', '뒤로'] },
    { name: '환상빔', damage: 20, value: 30, poses: ['정방향', '물구나무'] },
    { name: '사이코샷', damage: 30, value: 20, poses: ['정방향', '물구나무', '뒤로', '엎드림'] }
  ];
  for (const move of mewMoves) {
    for (const posture of move.poses) {
      const { result } = run(
        { type: 'bonus', value: move.value, poses: move.poses },
        { move: { damage: move.damage }, damage: move.damage, damageParts: [move.damage], posture }
      );
      assert.equal(result.damage, move.damage + move.value, `Mew ${move.name} bonus must apply in ${posture}`);
      assert.deepEqual(result.damageParts, [move.damage, move.value]);
    }
    const excludedPose = ['왼쪽', '오른쪽', '엎드림'].find(p => !move.poses.includes(p));
    if (excludedPose) {
      const { result } = run(
        { type: 'bonus', value: move.value, poses: move.poses },
        { move: { damage: move.damage }, damage: move.damage, damageParts: [move.damage], posture: excludedPose }
      );
      assert.equal(result.damage, move.damage, `Mew ${move.name} bonus must not apply in ${excludedPose}`);
    }
  }
}


{
  const { result } = run({ type: 'bonus', value: 20 });
  assert.equal(result.damage, 30);
  assert.deepEqual(result.damageParts, [10, 20]);
}
{
  const { result } = run({ type: 'bonus', value: 20, poses: ['뒤로'] }, { posture: '왼쪽' });
  assert.equal(result.damage, 10, 'pose-gated effect should not apply outside its pose');
}
{
  const { result } = run({ type: 'setDamage', value: 70 });
  assert.equal(result.damage, 70);
  assert.deepEqual(result.damageParts, [70], 'fixed damage should replace the old damage breakdown');
}
{
  const { result } = run({ type: 'heal', value: 20 });
  assert.equal(result.heal, 20);
}
{
  const { result } = run({ type: 'selfDamage', value: 15 });
  assert.equal(result.selfDamage, 15);
}
{
  const { result, ctx } = run({ type: 'diceShift', selfNext: -2, opponent: 1 });
  assert.equal(ctx.own.nextDice, -2);
  assert.equal(ctx.targetEffects.nextDice, 1);
  assert.equal(result.notes.length, 1);
}
{
  const { result, ctx } = run({ type: 'reduceNext', value: 30 });
  assert.equal(ctx.targetEffects.reduce, 30);
}
{
  const { result, ctx } = run({ type: 'reduceSelfNext', value: 30 });
  assert.equal(ctx.own.reduce, 30);
}
{
  const { result, ctx } = run({ type: 'opponentDice', value: -2 });
  assert.equal(ctx.targetEffects.nextDice, -2);
}
{
  const { result, ctx } = run({ type: 'blockMove' });
  assert.equal(ctx.targetEffects.blocked, 'blocked-id');
}
{
  const { result } = run({ type: 'fireCountBonus', value: 10 }, { counts: { 불꽃: 2 }, damageParts: [10] });
  assert.equal(result.damage, 30);
}
{
  const { result } = run({ type: 'lowHpBonus', value: 30, threshold: 40 }, { ownerHp: 30 });
  assert.equal(result.damage, 40);
}
{
  const { result } = run({ type: 'failMove' });
  assert.equal(result.failed, true);
}
{
  const { ctx } = run({ type: 'immuneSelfNext' });
  assert.equal(ctx.own.immuneNext, true);
}
{
  const { ctx } = run({ type: 'immuneNext' });
  assert.equal(ctx.own.immuneNext, true);
}
{
  const { ctx } = run({ type: 'skipPosture' });
  assert.equal(ctx.targetEffects.noPostureNext, true);
}
{
  const { ctx } = run({ type: 'skipRoll' });
  assert.equal(ctx.targetEffects.skipRoll, true);
}
{
  const { ctx } = run({ type: 'delayedDamage', value: 25 });
  assert.equal(ctx.targetEffects.startDamage, 25);
}
{
  const { ctx } = run({ type: 'poisonMark' });
  assert.equal(ctx.own.poisoned, true);
}
{
  const { result } = run({ type: 'healIfPoison', value: 20 }, { own: { poisoned: true } });
  assert.equal(result.heal, 20);
}
{
  const { result } = run({ type: 'bonusIfPoison', value: 20 }, { own: { poisoned: true } });
  assert.equal(result.damage, 30);
}
{
  const { result } = run({ type: 'bonusIfOpponentFailed', value: 20 }, { targetFailed: true });
  assert.equal(result.damage, 30);
}
{
  const { result } = run({ type: 'bonusIfSelfFailed', value: 20 }, { ownerFailed: true });
  assert.equal(result.damage, 30);
}
{
  const { result } = run({ type: 'conditionalBonus', value: 20, postures: ['뒤로'] });
  assert.equal(result.damage, 30);
}
{
  const { result } = run({ type: 'gyroBonus', value: 60, postures: ['엎드림'] });
  assert.equal(result.damage, 10, 'gyro bonus should not apply when the randomized posture misses its condition');
}
{
  const { result } = run({ type: 'opponentEnergyBonus', value: 10 });
  assert.equal(result.damage, 40, 'opponent-energy bonus should use the largest energy-type count from the supplied roll');
}
{
  const { result } = run({ type: 'reflectDouble', poses: ['정방향', '물구나무', '뒤로'] }, { posture: '왼쪽' });
  assert.equal(result.damage, 30, 'Reflection still deals base reflected damage outside its double-damage poses');
  assert.deepEqual(result.damageParts, [30]);
}
{
  const { result } = run({ type: 'reflectDouble', poses: ['정방향', '물구나무', '뒤로'] }, { posture: '뒤로' });
  assert.equal(result.damage, 60, 'Reflection doubles only in a listed posture');
  assert.deepEqual(result.damageParts, [30, 30]);
}
{
  const { result } = run({ type: 'reflectDouble', poses: ['정방향', '물구나무', '뒤로'] }, { posture: '뒤로', getTargetLastMove: () => null });
  assert.equal(result.damage, 0, 'Reflection has no base damage when no previous opponent move exists');
}
{
  const { result } = run({ type: 'repeat' }, { move: { damage: 20 }, counts: { 불꽃: 2, 물: 1 } });
  assert.equal(result.damage, 50, 'repeat uses the current total energy-symbol count');
}
{
  const { result } = run({ type: 'diceCountBonus', value: 30 }, { roll: [['불꽃'], ['물'], ['풀']] });
  assert.equal(result.damage, 100);
}
{
  const { result } = run({ type: 'extraRoll' });
  assert.equal(result.roll.length, 3);
  assert.equal(result.counts.불꽃, 2);
}

{
  const html = fs.readFileSync('./index.html', 'utf8');
  const coreSource = fs.readFileSync('./battle-core.js', 'utf8');
  const pokemonTypes = new Set(['풀', '불꽃', '물', '번개', '무색', '에스퍼', '악', '격투', '강철', '비행', 'application/json']);
  const usedEffects = [...html.matchAll(/type\s*:\s*['"]([^'"]+)['"]/g)]
    .map(match => match[1])
    .filter(type => !pokemonTypes.has(type));
  const implementedEffects = new Set([...coreSource.matchAll(/case\s+'([^']+)'/g)].map(match => match[1]));
  const missing = [...new Set(usedEffects)].filter(type => !implementedEffects.has(type));
  assert.deepEqual(missing, [], 'every effect used by the move database must have a shared-core handler');
  assert((html.match(/makeMove\(/g) || []).length >= 100, 'move database should be included in this coverage check');
}

{
  const index = fs.readFileSync('./index.html', 'utf8');
  assert(index.includes("rollOpponent:function(){return rollForTurn(opp,opp==='2',0,3).map(x=>x.face)}"),
    'opponent-energy bonus must roll using the target side dice configuration');
  assert(index.includes("face:rollFace(dieIndex,n==='2'?'2':'1')"),
    'dice face lookup must follow the actual side being rolled');
  assert(index.includes('rollExtra:function(){return rollForTurn(n,isAI,1,0).map(x=>x.face)}'),
    'extraRoll must choose a die index instead of always rolling die one');
}

{
  const pvp = fs.readFileSync('./pvp.js', 'utf8');
  const attack = pvp.indexOf('var att=ps[a.by],targetId=');
  const skip = pvp.indexOf('if(att.effects.skipRoll)', attack);
  const move = pvp.indexOf('var mon2=findMon(att.pokemon),move=', attack);
  const validation = pvp.indexOf('var moveCheck=PlakoroBattleCore.validateMove', attack);
  assert(attack >= 0 && skip > attack && move > skip && validation > move,
    'PvP must process a forced skipped turn before move selection and validation');
}


{
  const failed = core.applyDamageRules({ damage: 50, failed: true, move: { cost: { 불꽃: 1 } } });
  assert.equal(failed.damage, 0, 'failed attacks must deal no damage');
}
{
  const effects = { immuneNext: true };
  const blocked = core.applyDamageRules({ damage: 50, targetEffects: effects, move: { cost: { 불꽃: 1 } } });
  assert.equal(blocked.damage, 0);
  assert.equal(effects.immuneNext, false, 'a successful hit consumes the next-hit immunity');
}
{
  const effects = { reduce: 20 };
  const reduced = core.applyDamageRules({ damage: 50, targetEffects: effects, move: { cost: { 불꽃: 1 } } });
  assert.equal(reduced.damage, 30);
  assert.equal(effects.reduce, 0, 'damage reduction is consumed by a damaging hit');
}
{
  const weak = core.applyDamageRules({ damage: 50, weakness: '불꽃', move: { cost: { 불꽃: 1 } } });
  assert.equal(weak.damage, 70, 'weakness adds 20 damage');
  const ignored = core.applyDamageRules({ damage: 50, weakness: '불꽃', ignoreWeakness: true, move: { cost: { 불꽃: 1 } } });
  assert.equal(ignored.damage, 50, 'explicit weakness-ignore effects are respected');
}


{
  // Parse the real starterData array from the app and run every registered move
  // through the shared combat engine for every possible posture.
  const vm = require('node:vm');
  const index = fs.readFileSync('./index.html', 'utf8');
  const start = index.indexOf('const starterData=[');
  assert(start >= 0, 'starter move database must exist');
  const open = index.indexOf('[', start);
  let depth = 0, quote = null, escaped = false, end = -1;
  for (let i = open; i < index.length; i++) {
    const ch = index[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '[') depth++;
    else if (ch === ']' && --depth === 0) { end = i + 1; break; }
  }
  assert(end > open, 'starter move database array must parse');
  const starterData = vm.runInNewContext(index.slice(open, end), { makeMove: (name, cost, damage, effects = [], memo = '', base = {}) => ({ name, cost, damage, effects, memo, ...base }) });
  const postures = ['정방향', '왼쪽', '오른쪽', '뒤로', '엎드림', '물구나무', '뒤집힘'];
  let simulated = 0;
  for (const pokemon of starterData) {
    assert(Array.isArray(pokemon.moves), pokemon.name + ' must have a move list');
    for (const move of pokemon.moves) {
      assert(move.name && move.cost && Number.isFinite(Number(move.damage)), pokemon.name + ' has malformed move data');
      // Construct a roll that satisfies each move's exact energy cost.
      const paymentRoll = [];
      for (const [type, amount] of Object.entries(move.cost || {})) {
        for (let i = 0; i < Number(amount || 0); i++) paymentRoll.push([type === '무색' ? '비행' : type]);
      }
      assert(core.canPay(move.cost, paymentRoll), pokemon.name + ' / ' + move.name + ': a roll matching its cost must pay');
      if (Object.keys(move.cost || {}).length) {
        const failed = core.applyDamageRules({ damage: Number(move.damage) || 0, failed: true, move });
        assert.equal(failed.damage, 0, pokemon.name + ' / ' + move.name + ': failed energy check must deal zero damage');
      }
      for (const posture of postures) {
        const own = {}, targetEffects = {}, notes = [];
        const ctx = {
          move, own, targetEffects, notes, damage: Number(move.damage) || 0,
          damageParts: [Number(move.damage) || 0], heal: 0,
          selfDamage: Number(move.baseSelfDamage) || 0, failed: false,
          roll: [['불꽃'], ['물'], ['에스퍼']], counts: { 불꽃: 1, 물: 1, 에스퍼: 1 },
          posture, ownerHp: 120, ownerFailed: false, targetFailed: false,
          randomPose: () => '뒤로', rollPostures: n => Array.from({length:n}, (_,i)=>postures[i % postures.length]),
          chooseBlockedMove: () => ({id:'sim-block',name:'시뮬레이션 기술'}),
          rollOpponent: () => [['물'], ['물'], ['불꽃']],
          rollExtra: () => [['에스퍼']],
          getTargetLastMove: () => ({damage: 30})
        };
        const effects = core.applyMoveEffects(ctx);
        const damageResult = core.applyDamageRules({
          damage: effects.damage, failed: effects.failed, targetEffects,
          move, weakness: '에스퍼', ignoreWeakness: move.name === '일렉러쉬'
        });
        assert(Number.isFinite(effects.damage), pokemon.name + ' / ' + move.name + ' / ' + posture + ': damage must be finite');
        assert(Number.isFinite(damageResult.damage) && damageResult.damage >= 0,
          pokemon.name + ' / ' + move.name + ' / ' + posture + ': final damage must be valid');
        assert(Number.isFinite(effects.heal) && Number.isFinite(effects.selfDamage),
          pokemon.name + ' / ' + move.name + ' / ' + posture + ': healing/self-damage must be valid');
        assert(Array.isArray(effects.notes) && Array.isArray(effects.damageParts),
          pokemon.name + ' / ' + move.name + ' / ' + posture + ': result details must be arrays');
        simulated++;
      }
    }
  }
  assert(simulated >= 700, 'expected hundreds of real move/posture simulation cases');
  console.log('Exhaustive move simulation passed: ' + starterData.length + ' Pokémon, ' + simulated + ' move/posture cases.');
}

console.log('Battle core tests passed: shared helpers, all effect handlers and exhaustive move simulations, move-database coverage, and PvP skipped-turn ordering.');


// Interaction/regression tests: multiple effects and persistent defensive states.
{
  const { result, ctx } = run(
    { type: 'bonus', value: 20 },
    { damage: 30, damageParts: [30], move: { damage: 30, effects: [
      { type: 'bonus', value: 20, poses: ['정방향'] },
      { type: 'heal', value: 15 },
      { type: 'selfDamage', value: 5 }
    ] } }
  );
  // run() intentionally overrides effects with its single effect, so exercise the
  // real multi-effect list directly here.
  const multi = {
    move: { damage: 30, effects: [
      { type: 'bonus', value: 20, poses: ['정방향'] },
      { type: 'heal', value: 15 },
      { type: 'selfDamage', value: 5 }
    ] },
    own: {}, targetEffects: {}, notes: [], damage: 30, damageParts: [30],
    heal: 0, selfDamage: 0, failed: false, roll: [['불꽃']], counts: { 불꽃: 1 },
    posture: '정방향', ownerHp: 80
  };
  const out = core.applyMoveEffects(multi);
  assert.equal(out.damage, 50);
  assert.equal(out.heal, 15);
  assert.equal(out.selfDamage, 5);
  assert.deepEqual(out.damageParts, [30, 20]);
}
{
  // Defensive states must be consumed once and not leak to the next attack.
  const effects = { reduce: 25 };
  const first = core.applyDamageRules({ damage: 20, targetEffects: effects, move: { cost: { 불꽃: 1 } } });
  assert.equal(first.damage, 0);
  assert.equal(effects.reduce, 0);
  const second = core.applyDamageRules({ damage: 20, targetEffects: effects, move: { cost: { 불꽃: 1 } } });
  assert.equal(second.damage, 20);
}
{
  // Failed attacks do not consume a one-hit immunity or damage reduction.
  const effects = { immuneNext: true, reduce: 15 };
  const result = core.applyDamageRules({ damage: 40, failed: true, targetEffects: effects, move: { cost: { 불꽃: 1 } } });
  assert.equal(result.damage, 0);
  assert.equal(effects.immuneNext, true);
  assert.equal(effects.reduce, 15);
}
{
  // Cost payment must respect type-specific requirements before colorless costs.
  assert.equal(core.canPay({ 불꽃: 1, 무색: 2 }, [['불꽃'], ['물'], ['에스퍼']]), true);
  assert.equal(core.canPay({ 불꽃: 1, 무색: 2 }, [['물'], ['물'], ['에스퍼']]), false);
  assert.equal(core.canPay({ 불꽃: 2, 무색: 1 }, [['불꽃', '물'], ['불꽃'], ['풀']]), true);
  assert.equal(core.canPay({ 불꽃: 2, 무색: 1 }, [['불꽃'], ['물'], ['풀']]), false);
}
{
  // Posture-gated effects should be isolated; unsupported postures must not mutate state.
  const move = { damage: 10, effects: [
    { type: 'bonus', value: 40, poses: ['물구나무'] },
    { type: 'reduceNext', value: 20, poses: ['뒤집힘'] }
  ] };
  const ctx = { move, own: {}, targetEffects: {}, notes: [], damage: 10, damageParts: [10],
    heal: 0, selfDamage: 0, failed: false, roll: [], counts: {}, posture: '정방향' };
  const result = core.applyMoveEffects(ctx);
  assert.equal(result.damage, 10);
  assert.deepEqual(ctx.targetEffects, {});
  assert.deepEqual(ctx.own, {});
}
{
  // Zero damage should remain zero after reductions and must not gain weakness damage.
  const result = core.applyDamageRules({ damage: 0, weakness: '불꽃', move: { cost: { 불꽃: 1 } } });
  assert.equal(result.damage, 0);
}


// Oracle comparison tests: expected damage is calculated independently from the
// real move database, then compared with the shared engine's actual result.
{
  const vm = require('node:vm');
  const index = fs.readFileSync('./index.html', 'utf8');
  const start = index.indexOf('const starterData=[');
  const open = index.indexOf('[', start);
  let depth = 0, quote = null, escaped = false, end = -1;
  for (let i = open; i < index.length; i++) {
    const ch = index[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '[') depth++;
    else if (ch === ']' && --depth === 0) { end = i + 1; break; }
  }
  assert(end > open, 'oracle: actual move data must parse');
  const data = vm.runInNewContext(index.slice(open, end), {
    makeMove: (name, cost, damage, effects = [], memo = '', base = {}) => ({ name, cost, damage, effects, memo, ...base })
  });
  const postures = ['정방향', '왼쪽', '오른쪽', '뒤로', '엎드림', '물구나무', '뒤집힘'];
  const fixedOracle = {
    '뮤|염동력': { '정방향': 30, '왼쪽': 10, '오른쪽': 10, '뒤로': 30, '엎드림': 10, '물구나무': 30, '뒤집힘': 10 },
    '뮤|환상빔': { '정방향': 50, '왼쪽': 20, '오른쪽': 20, '뒤로': 20, '엎드림': 20, '물구나무': 50, '뒤집힘': 20 },
    '뮤|사이코샷': { '정방향': 50, '왼쪽': 30, '오른쪽': 30, '뒤로': 50, '엎드림': 50, '물구나무': 50, '뒤집힘': 30 },
    '파이리|불꽃세례': { '정방향': 50, '왼쪽': 20, '오른쪽': 50, '뒤로': 20, '엎드림': 20, '물구나무': 20, '뒤집힘': 20 },
    '꼬부기|물대포': { '정방향': 30, '왼쪽': 10, '오른쪽': 30, '뒤로': 10, '엎드림': 10, '물구나무': 10, '뒤집힘': 10 },
    '이브이|돌아다니면서 뛰기': { '정방향': 70, '왼쪽': 20, '오른쪽': 20, '뒤로': 40, '엎드림': 20, '물구나무': 40, '뒤집힘': 0 }
  };
  let checked = 0;
  for (const pokemon of data) for (const move of pokemon.moves) {
    const oracle = fixedOracle[pokemon.name + '|' + move.name];
    if (!oracle) continue;
    for (const posture of postures) {
      const ctx = {
        move, own: {}, targetEffects: {}, notes: [],
        damage: Number(move.damage) || 0, damageParts: [Number(move.damage) || 0],
        heal: 0, selfDamage: Number(move.baseSelfDamage) || 0, failed: false,
        roll: [['불꽃'], ['물'], ['에스퍼']], counts: { 불꽃: 1, 물: 1, 에스퍼: 1 },
        posture, ownerHp: 120, ownerFailed: false, targetFailed: false,
        randomPose: () => '뒤로', rollPostures: n => Array.from({ length: n }, () => '정방향'),
        chooseBlockedMove: () => null, rollOpponent: () => [['물'], ['물'], ['불꽃']],
        rollExtra: () => [['에스퍼']], getTargetLastMove: () => ({ damage: 30 })
      };
      const actual = core.applyMoveEffects(ctx).damage;
      assert.equal(actual, oracle[posture], pokemon.name + ' / ' + move.name + ' / ' + posture + ': expected vs actual damage mismatch');
      checked++;
    }
  }
  assert.equal(checked, 42, 'oracle must compare every posture for all six representative moves');
  console.log('Expected-vs-actual damage oracle passed: ' + checked + ' comparisons across live move data.');
}

{
  // Mobile layout regression checks: tutorial text and actions must remain reachable in short viewports.
  const html = fs.readFileSync('./index.html', 'utf8');
  assert(html.includes("#tutorialModal .tutorial-dialog{display:flex;flex-direction:column"), 'tutorial modal must use a constrained flex layout');
  assert(html.includes("#tutorialModal .tutorial-modal-body{flex:1 1 auto;min-height:0;overflow-y:auto"), 'tutorial body must scroll instead of clipping long steps');
  assert(html.includes("#tutorialModal .tutorial-modal-footer{flex:0 0 auto;position:sticky"), 'tutorial navigation must stay visible while reading');
  assert(html.includes("env(safe-area-inset-bottom)"), 'dialogs must respect mobile safe-area insets');
  assert(html.includes("bubble.style.maxHeight=Math.max(120,Math.min(viewH-2*edge,above?spaceAbove:spaceBelow))"), 'tutorial coach bubble must fit the visible viewport');
  assert(html.includes("target.scrollIntoView({behavior:'auto',block:'center',inline:'nearest'})"), 'tutorial coach must position after a non-animated target scroll');
  assert(html.includes("@media(max-height:560px)"), 'short-height devices must have a compact tutorial layout');
}
