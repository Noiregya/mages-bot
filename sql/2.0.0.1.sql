ALTER TABLE guilds RENAME COLUMN nb_star to vote_pin;

CREATE TABLE IF NOT EXISTS public.votes (
    vote_type text NOT NULL,
    guild numeric NOT NULL,
    channel numeric NOT NULL,
    user_message numeric NOT NULL,
    mages_message numeric NOT NULL,
    votes text NOT NULL,
    goal integer DEFAULT 0 NOT NULL,
    end_date timestamp NOT NULL
);

ALTER TABLE ONLY public.votes DROP CONSTRAINT IF EXISTS votes_guild_fkey;

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_guild_fkey FOREIGN KEY (guild) REFERENCES public.guilds(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.votes DROP CONSTRAINT IF EXISTS votes_pkey;

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_pkey PRIMARY KEY (vote_type, guild, channel, user_message);

CREATE FUNCTION expunge_votes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM votes WHERE end_date < CURRENT_TIMESTAMP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_expunge_votes
    AFTER INSERT ON votes
    EXECUTE PROCEDURE expunge_votes();