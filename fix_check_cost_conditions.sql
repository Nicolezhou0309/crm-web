-- 修正 check_cost_conditions 函数，避免 leadtype 为 null 或空字符串时命中
CREATE OR REPLACE FUNCTION public.check_cost_conditions(
    conditions jsonb,
    p_source source,
    p_leadtype text,
    p_campaignname text DEFAULT NULL,
    p_unitname text DEFAULT NULL,
    p_remark text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
    extracted_community text;
BEGIN
    -- 检查来源条件
    IF conditions ? 'sources' AND p_source IS NOT NULL THEN
        IF NOT (p_source::text = ANY(ARRAY(SELECT jsonb_array_elements_text(conditions->'sources')))) THEN
            RETURN false;
        END IF;
    END IF;
    
    -- 显式避免 leadtype 为 null 或空字符串时命中
    IF conditions ? 'lead_types' AND (p_leadtype IS NULL OR p_leadtype = '') THEN
        RETURN false;
    END IF;
    -- 检查线索类型条件
    IF conditions ? 'lead_types' AND p_leadtype IS NOT NULL THEN
        IF NOT (p_leadtype = ANY(ARRAY(SELECT jsonb_array_elements_text(conditions->'lead_types')))) THEN
            RETURN false;
        END IF;
    END IF;
    
    -- 检查关键词条件（包含从remark中提取的社区信息）
    IF conditions ? 'keywords' THEN
        DECLARE
            keyword text;
            found_keyword boolean := false;
        BEGIN
            -- 优先从remark中提取community信息
            IF p_remark IS NOT NULL AND p_remark ~ '\[COMMUNITY:([^\]]+)\]' THEN
                extracted_community := (regexp_match(p_remark, '\[COMMUNITY:([^\]]+)\]'))[1];
            END IF;
            
            FOR keyword IN SELECT jsonb_array_elements_text(conditions->'keywords')
            LOOP
                IF (p_campaignname ILIKE '%' || keyword || '%' OR
                    p_unitname ILIKE '%' || keyword || '%' OR
                    p_remark ILIKE '%' || keyword || '%' OR
                    (extracted_community IS NOT NULL AND extracted_community ILIKE '%' || keyword || '%')) THEN
                    found_keyword := true;
                    EXIT;
                END IF;
            END LOOP;
            
            IF NOT found_keyword THEN
                RETURN false;
            END IF;
        END;
    END IF;
    
    RETURN true;
END;
$$; 