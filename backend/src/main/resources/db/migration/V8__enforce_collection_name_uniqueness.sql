CREATE UNIQUE INDEX uk_collections_user_name
    ON collections (user_id, LOWER(BTRIM(name)));
