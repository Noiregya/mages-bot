alter table nations drop column color;
alter table nations drop column ranking;
alter table nations add column ranking smallint default -1 not null;
alter table nations drop constraint is_nation_unique;
alter table nations add constraint is_nation_unique UNIQUE(guild, role);
