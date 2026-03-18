-- KEYS[1] = boss:{id}:hp
-- KEYS[2] = boss:{id}:damage
-- KEYS[3] = boss:{id}:last1pct
-- KEYS[4] = boss:{id}:killed
-- ARGV[1] = userId
-- ARGV[2] = damageAmount
-- ARGV[3] = last1pctThreshold
-- Returns: {newHp (integer), killed (0/1), winnerId (string)}

local userId = ARGV[1]
local dmg = tonumber(ARGV[2])
local threshold = tonumber(ARGV[3])

-- Increment this user's fight damage
redis.call('HINCRBY', KEYS[2], userId, dmg)

-- Track last-1% eligibility: if HP is already in the last 1%, this player qualifies
local prevHp = tonumber(redis.call('GET', KEYS[1]) or '0')
if prevHp <= threshold then
  redis.call('HSET', KEYS[3], userId, '1')
end

-- Atomic decrement (floor at 0)
local newHp = redis.call('DECRBY', KEYS[1], dmg)
if newHp < 0 then
  redis.call('SET', KEYS[1], '0')
  newHp = 0
end

-- Kill claim: atomic single-winner guarantee via SETNX
if newHp == 0 then
  local claimed = redis.call('SETNX', KEYS[4], userId)
  if claimed == 1 then
    return {newHp, 1, userId}
  end
end

return {newHp, 0, ''}
