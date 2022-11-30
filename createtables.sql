create table guilds(id text NOT NULL, name text, information_channel_id text, shares_message_id, welcome_channel_id text, active_delay text NOT NULL DEFAULT 30, random_assign_nation boolean, nb_star int NOT NULL DEFAULT 0, is_frozen boolean DEFAULT false, PRIMARY KEY(id));

create table nations(name text NOT NULL, description text, color integer, thumbnail text, message_id text, role_id text, guild_id text NOT NULL, isunique boolean NOT NULL DEFAULT false, ranking integer, PRIMARY KEY(name, guild_id));
CREATE UNIQUE INDEX CONCURRENTLY is_unique ON nations (name, guild_id);
ALTER TABLE nations ADD CONSTRAINT is_nation_unique UNIQUE USING INDEX is_unique;

create table users(id text NOT NULL, nation text, muted boolean NOT NULL DEFAULT false, guild_id text NOT NULL, PRIMARY KEY(id), FOREIGN KEY(nation) REFERENCES nations(name));
ALTER TABLE users ADD UNIQUE(id, guild_id);

create table roles(citizen text NOT NULL, guild text NOT NULL, role text NOT NULL,
PRIMARY KEY(citizen, guild, role),
FOREIGN KEY(citizen, guild) REFERENCES users(id, guild_id));

create table administration(role text NOT NULL, guild text NOT NULL, powerLevel smallint NOT NULL DEFAULT 99,
PRIMARY KEY(role, guild));
comment on column administration.powerlevel is '0 - Bot owner, 1 - Server Owner level, 2 - Administrator, 3 - Moderator, 98 - informated user, 99 - no power';
ALTER TABLE administration ADD UNIQUE(role, guild);
CREATE UNIQUE INDEX CONCURRENTLY is_unique ON administration (role, guild);
ALTER TABLE administration ADD CONSTRAINT is_unique_constraint UNIQUE USING INDEX is_unique;

create table admin_whitelist(user_id text NOT NULL, guild_id text not null, username text,  PRIMARY KEY (user_id, guild_id));

create table active_role(guild text NOT NULL, id text NOT NULL, def_give boolean NOT NULL DEFAULT FALSE, PRIMARY KEY(guild, id), FOREIGN KEY(guild) REFERENCES guilds(id));
