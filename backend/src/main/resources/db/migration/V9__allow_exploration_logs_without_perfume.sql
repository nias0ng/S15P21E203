-- 빈 바다 클릭을 기록할 수 있게 합니다.
--
-- 향 지도에서 배는 향수를 눌러도 움직이고 빈 바다를 눌러도 움직입니다. 빈 바다로 간 이동은
-- 가리키는 향수가 없으므로 perfume_id 에 넣을 값이 없습니다. NOT NULL 이면 그 이동을 아예
-- 기록할 수 없어 "다른 향 영역으로 넘어갔다" 는 사실이 남지 않습니다.
ALTER TABLE map_exploration_logs
    ALTER COLUMN perfume_id DROP NOT NULL;

-- 사용자별 최신순 조회에 쓰는 인덱스입니다.
--
-- 두 곳이 씁니다. 향해 일지는 "내 기록을 최신순으로" 읽고, 기록을 남길 때도 직전 기록 한 줄을
-- 읽어 향 영역이 바뀌었는지 봅니다. 이 표는 사용자가 배를 움직일 때마다 쌓이므로 인덱스 없이
-- 두면 사용자 한 명의 기록을 찾는 데 표 전체를 훑습니다.
CREATE INDEX idx_map_exploration_logs_user
    ON map_exploration_logs (user_id, visited_at DESC);
