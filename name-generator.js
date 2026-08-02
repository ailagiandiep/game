function normalizePlayerNames(raw) {
  return raw
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

function findDuplicateNames(names) {
  const seen = new Set();
  const duplicates = [];

  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) {
      if (!duplicates.includes(name.trim())) duplicates.push(name.trim());
    } else {
      seen.add(key);
    }
  }

  return duplicates;
}

function generatePlayerNames(configSets, targetCount) {
  if (!Array.isArray(configSets) || !configSets.length) return [];
  if (!Number.isInteger(targetCount) || targetCount <= 0) return [];

  const validSets = configSets.filter(Array.isArray);
  if (!validSets.length) return [];

  const maxSetLength = Math.max(...validSets.map(set => {
    const pool = set.map(value => String(value).trim()).filter(Boolean);
    return pool.length;
  }));

  if (targetCount > maxSetLength) return [];

  const randomSetIndex = Math.floor(Math.random() * validSets.length);
  const chosenSet = validSets[randomSetIndex];
  const pool = chosenSet
    .map(value => String(value).trim())
    .filter(Boolean);

  if (pool.length < targetCount) return [];

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, targetCount);
}

module.exports = {
  normalizePlayerNames,
  findDuplicateNames,
  generatePlayerNames,
};
