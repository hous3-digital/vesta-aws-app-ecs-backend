create or replace function generate_unique_second_timestamptz()
returns timestamptz
language plpgsql
as $$
declare
    current_timestamp_s  timestamptz;
    previous_timestamp_s timestamptz;
begin
    perform pg_advisory_xact_lock(0, 42);

    current_timestamp_s := date_trunc('second', clock_timestamp() at time zone 'utc');

    if to_regclass('pg_temp.last_timestamp') is null then
        create temp table pg_temp.last_timestamp (last_timestamp timestamptz);
        insert into pg_temp.last_timestamp values (current_timestamp_s);
        return current_timestamp_s;
    end if;

    select last_timestamp into previous_timestamp_s
    from pg_temp.last_timestamp
    limit 1;

    if current_timestamp_s <= previous_timestamp_s then
        current_timestamp_s := previous_timestamp_s + interval '1 second';
    end if;

    update pg_temp.last_timestamp
    set last_timestamp = current_timestamp_s;

    return current_timestamp_s;
end;
$$;

