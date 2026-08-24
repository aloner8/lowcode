-- PostgreSQL tenant blueprint adapted from the YII/MySQL query patterns.
-- Apply after the municipal raw tables have been migrated into a tenant DB.

CREATE OR REPLACE FUNCTION fn_menu_tree(p_position text DEFAULT 'top')
RETURNS TABLE(id bigint, parent_id bigint, menu_name text, url text, icon text, depth integer, sort_path integer[])
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE menu_tree AS (
    SELECT m.id::bigint, m.parent_id::bigint, m.menu_name::text, m.url::text,
           COALESCE(m.icon, '')::text AS icon, 1 AS depth, ARRAY[m.sort_order::integer, m.id::integer] AS sort_path
    FROM cms_menu m
    WHERE m.parent_id IS NULL AND m.position = p_position AND m.status = 1
    UNION ALL
    SELECT c.id::bigint, c.parent_id::bigint, c.menu_name::text, c.url::text,
           COALESCE(c.icon, '')::text, p.depth + 1, p.sort_path || ARRAY[c.sort_order::integer, c.id::integer]
    FROM cms_menu c JOIN menu_tree p ON p.id = c.parent_id
    WHERE c.position = p_position AND c.status = 1 AND p.depth < 3
  ) SELECT * FROM menu_tree ORDER BY sort_path;
$$;

CREATE OR REPLACE FUNCTION fn_published_posts(p_category_id bigint DEFAULT NULL, p_limit integer DEFAULT 12, p_offset integer DEFAULT 0)
RETURNS SETOF cms_post LANGUAGE sql STABLE AS $$
  SELECT p.* FROM cms_post p
  WHERE p.status = 1 AND (p_category_id IS NULL OR p.cms_category_id = p_category_id)
    AND (p.publish_at IS NULL OR to_timestamp(p.publish_at) <= now())
  ORDER BY p.publish_at DESC NULLS LAST, p.id DESC LIMIT p_limit OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION fn_procurement_feed(p_types text[] DEFAULT NULL, p_limit integer DEFAULT 20)
RETURNS SETOF cms_egp LANGUAGE sql STABLE AS $$
  SELECT e.* FROM cms_egp e WHERE p_types IS NULL OR e.type = ANY(p_types)
  ORDER BY e.pub_date DESC NULLS LAST, e.id DESC LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION fn_active_slides(p_limit integer DEFAULT 10)
RETURNS SETOF cms_slide LANGUAGE sql STABLE AS $$
  SELECT s.* FROM cms_slide s WHERE s.status = 1
    AND (s.always_show = 1 OR ((s.show_from IS NULL OR s.show_from <= now()) AND (s.show_to IS NULL OR s.show_to >= now())))
  ORDER BY s.sort_order, s.id LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION fn_site_search(p_query text, p_limit integer DEFAULT 20)
RETURNS TABLE(source_type text, source_id bigint, title text, excerpt text, rank real)
LANGUAGE sql STABLE AS $$
  SELECT 'post', p.id, p.name::text, left(regexp_replace(p.description, '<[^>]+>', '', 'g'), 240),
         similarity(p.name, p_query)::real FROM cms_post p
  WHERE p.status = 1 AND (p.name ILIKE '%' || p_query || '%' OR p.description ILIKE '%' || p_query || '%')
  UNION ALL
  SELECT 'page', g.id, g.name::text, left(regexp_replace(g.description, '<[^>]+>', '', 'g'), 240),
         similarity(g.name, p_query)::real FROM cms_page g
  WHERE g.name ILIKE '%' || p_query || '%' OR g.description ILIKE '%' || p_query || '%'
  ORDER BY rank DESC LIMIT p_limit;
$$;

CREATE OR REPLACE PROCEDURE sp_increment_site_visit(p_visit_date date DEFAULT CURRENT_DATE)
LANGUAGE plpgsql AS $$ BEGIN
  INSERT INTO site_visit_daily_stat(stat_date, visit_count, created_at, updated_at)
  VALUES (p_visit_date, 1, extract(epoch FROM now())::integer, extract(epoch FROM now())::integer)
  ON CONFLICT (stat_date) DO UPDATE SET visit_count = site_visit_daily_stat.visit_count + 1,
    updated_at = extract(epoch FROM now())::integer;
END $$;

CREATE OR REPLACE PROCEDURE sp_submit_complaint(p_payload jsonb)
LANGUAGE plpgsql AS $$ BEGIN
  INSERT INTO complaint(title, name, id_card, address, detail, status, created_at, updated_at)
  VALUES (p_payload->>'title', p_payload->>'name', p_payload->>'idCard', p_payload->>'address',
          p_payload->>'detail', 1, extract(epoch FROM now())::integer, extract(epoch FROM now())::integer);
END $$;
