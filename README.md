# What is this

This is a very simple JSON based diary/log, with extensible metadata.

I use it witih the TaskWarrior plugin to collect notes alongside tasks.

usage:

- setup data dir:

`mourt -D dir=/path/to/mourt.d`

- enter a log

`mourt -m 'did some stuff'`

if you have taskwarrior , the currently active task is recorded also.

`mourt -l`

Lists all entries

## Configuring with dock-warrior

```
mourt -D 'plugin.taskw.command=dock-warrior'
mourt -D 'plugin.taskw.args=-b task +ACTIVE export'
```

### Configuration

|  Option              |  Comment        | Default                                        |
|----------------------|-----------------|------------------------------------------------|
|    dir               | Storage         | None, must set                                 |
| plugin.taskw.command | Path to 'task'  | `task`                                         |
| plugin.taskw.args    | Args for 'task' | `+ACTIVE export`                               |

# LICENSE

Apache-2.0 see ./LICENSE
Copyright (c) 2022 Code Hive Tx, LLC
