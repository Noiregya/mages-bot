alter table nations drop column color;
alter table nations drop column ranking;
alter table nations add column ranking smallint default -1 not null;
alter table nations drop constraint is_nation_unique;
alter table nations add constraint is_nation_unique UNIQUE(guild, role);
create table messages(guild numeric not null, channel numeric not null, id numeric not null, type character varying);
alter table messages add constraint messages_pkey PRIMARY KEY(guild, channel, id);
alter table messages add constraint messages_guild_fkey FOREIGN KEY(guild) REFERENCES guilds(id) ON DELETE CASCADE;
alter table admin_whitelist rename column "user" to id;
