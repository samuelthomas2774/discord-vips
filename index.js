module.exports = (Plugin, { Api: PluginApi, Utils, WebpackModules, Patcher, monkeyPatch, Reflection, ReactComponents, Logger, VueInjector, Toasts, DiscordApi, CommonComponents }, Vendor) => class VIPs extends Plugin {

    onstart() {
        this.patchFriends();
        this.patchFriendRow();
        this.patchUserProfileModal();
    }

    onstop() {
        Patcher.unpatchAll();

        for (let friends of document.querySelectorAll('#friends')) {
            Reflection(friends).forceUpdate();
        }
    }

    get bridge() {
        return this._bridge || (this._bridge = {
            get vips() { return Utils.deepclone(PluginApi.plugin.vips) },
            addVIP: this.addVIP.bind(this),
            removeVIP: this.removeVIP.bind(this),
            getGroup: name => Utils.deepclone(this.getGroup(name)),
            addGroup: name => Utils.deepclone(this.addGroup(name)),
            removeGroup: group => this.removeGroup(this.getGroup(group.name)),
            isGroupMember: (group, id) => this.isGroupMember(this.getGroup(group.name), id),
            addToGroup: (group, id) => this.addToGroup(this.getGroup(group.name), id),
            removeFromGroup: (group, id) => this.removeFromGroup(this.getGroup(group.name), id)
        });
    }

    get vips() {
        if (!this.data.vips) this.data.vips = ['391543027052838913', '249746236008169473'];
        return this.data.vips;
    }

    addVIP(id) {
        if (this.vips.includes(id)) return;
        this.vips.push(id);

        for (let friends of document.querySelectorAll('#friends')) {
            Reflection(friends).forceUpdate();
        }

        return this.saveConfiguration();
    }

    removeVIP(id) {
        if (!this.vips.includes(id)) return;
        Utils.removeFromArray(this.vips, id);

        for (let friends of document.querySelectorAll('#friends')) {
            Reflection(friends).forceUpdate();
        }

        return this.saveConfiguration();
    }

    get groups() {
        return this.data.groups || (this.data.groups = []);
    }

    getGroup(name) {
        return this.groups.find(g => g.name === name);
    }

    async addGroup(name) {
        if (this.groups.find(g => g.name === name)) return;
        const group = this.groups.push({name, members: []});

        for (let friends of document.querySelectorAll('#friends')) {
            Reflection(friends).forceUpdate();
        }

        await this.saveConfiguration();
        return group;
    }

    removeGroup(group) {
        if (!this.groups.includes(group)) return;
        Utils.removeFromArray(this.groups, group);

        for (let friends of document.querySelectorAll('#friends')) {
            Reflection(friends).forceUpdate();
        }

        return this.saveConfiguration();
    }

    isGroupMember(group, id) {
        return this.groups.includes(group) && group.members.includes(id);
    }

    addToGroup(group, id) {
        if (!this.groups.includes(group)) return;
        if (group.members.includes(id)) return;
        group.members.push(id);

        for (let friends of document.querySelectorAll('#friends')) {
            Reflection(friends).forceUpdate();
        }

        return this.saveConfiguration();
    }

    removeFromGroup(group, id) {
        if (!this.groups.includes(group)) return;
        if (!group.members.includes(id)) return;
        Utils.removeFromArray(group.members, id);

        for (let friends of document.querySelectorAll('#friends')) {
            Reflection(friends).forceUpdate();
        }

        return this.saveConfiguration();
    }

    async patchFriends() {
        const Friends = WebpackModules.getModuleByDisplayName('Friends');
        // const Friends = await ReactComponents.getComponent('Friends', {selector: '#friends'});

        Logger.log('Friends', global._Friends = Friends);

        monkeyPatch(Friends.prototype).after('render', (thisObject, args, returnValue, setReturnValue) => {
            Logger.log('Friends render called', thisObject, args, returnValue);

            let sections = returnValue.props.children[0].props.children.props.children;
            sections.push(sections[1]);

            for (let group of [{
                name: 'VIP',
                members: this.vips
            }].concat(this.groups)) {
                for (let id of group.members) {
                    const user = DiscordApi.User.fromId(id);

                    if (!thisObject.state.rows._rows[0] || !user) continue;

                    let mutualGuilds = [];
                    for (let guild of DiscordApi.guilds) {
                        if (guild.isMember(id)) mutualGuilds.push(guild.discordObject);
                    }

                    let objectRow = new (thisObject.state.rows._rows[0].constructor)({
                        activity: WebpackModules.UserStatusStore.getActivity(id),
                        key: `vips-${group.name}-${id}`,
                        mutualGuilds: mutualGuilds.slice(0, 5),
                        mutualGuildsLength: mutualGuilds.length,
                        status: WebpackModules.UserStatusStore.getStatus(id),
                        type: 99,
                        user: user.discordObject,
                        usernameLower: user.usernameLowerCase
                    });
                    objectRow.__vips_group = group;

                    let found = thisObject.state.rows._rows.find(row => row.key === objectRow.key && row.type === objectRow.type && row.__vips_group === group);
                    if (!found) thisObject.state.rows._rows.push(objectRow);
                    else Object.assign(found, objectRow);

                    for (let row of thisObject.state.rows._rows) {
                        if (!group.members.some(id => (row.type === 99 && row.key === id && row.__vips_group === group)) || (row.type !== 99)) {
                            let index = thisObject.state.rows._rows.indexOf(row);
                            // if (index > -1) thisObject.state.rows._rows.splice(index, 1);
                        }
                    }
                }

                if (!group.members.length) {
                    for (let row of thisObject.state.rows._rows) {
                        if (row.type !== 99 || row.__vips_group !== group) continue;
                        let index = thisObject.state.rows._rows.indexOf(row);
                        if (index > -1) thisObject.state.rows._rows.splice(index, 1);
                    }
                }

                let sections = returnValue.props.children[0].props.children.props.children;
                const vipTab = WebpackModules.React.cloneElement(sections[2], {children: group.name});
                vipTab.key = `vips-${group.name}`;
                sections.push(vipTab);
            }

            if (!thisObject.state.section.startsWith('vips-')) return;

            let VIPs = [];
            for (let row of thisObject.state.rows._rows) {
                if (row.type === 99 && thisObject.state.section.startsWith('vips-') && row.__vips_group && (thisObject.state.section.substr(5) === row.__vips_group.name)) VIPs.push(row);
            }

            Logger.log('VIPs:', VIPs);

            let Row = returnValue.props.children[1].props.children[1].props.children.props.children[0].type
                   || returnValue.props.children[1].props.children[1].props.children[0].type;
            if (!Row) return;

            if (returnValue.props.children[1].props.children[1].props.children.props.children) {
                returnValue.props.children[1].props.children[1].props.children.props.children = VIPs.map(vip =>
                    WebpackModules.React.createElement(Row, Object.assign({}, vip)));
            } else {
                returnValue.props.children[1].props.children[1].props.children = VIPs.map(vip =>
                    WebpackModules.React.createElement(Row, Object.assign({}, vip)));
            }
        });

        for (let friends of document.querySelectorAll('#friends')) {
            Reflection(friends).forceUpdate();
        }

        Toasts.push(`${this.name} v${this.version} started.`);
    }

    async patchFriendRow() {
        const FriendRow = await ReactComponents.getComponent('FriendRow', {selector: '.friends-row'}, c => c.prototype.handleOpenProfile);

        Logger.log('FriendRow', global._FriendRow = FriendRow);

        monkeyPatch(FriendRow.component.prototype).after('render', (component, args, retVal, setReturnValue) => {
            Logger.log('FriendRow render called', component, args, retVal);

            retVal.props.children[3].props.children.push(VueInjector.createReactElement(this.VIPIcon, {
                user: component.props.user
            }));
        });

        for (let friendRow of document.querySelectorAll('.friends-row')) {
            Reflection(friendRow).forceUpdate();
        }
    }

    async patchUserProfileModal() {
        const UserProfileModal = await ReactComponents.getComponent('UserProfileModal');

        Logger.log('Found UserProfileModal', UserProfileModal);

        monkeyPatch(UserProfileModal.component.prototype).after('renderHeader', (component, args, retVal) => {
            retVal.props.children.push(VueInjector.createReactElement(this.VIPIcon, {
                user: component.props.user
            }));
        });
    }

    get VIPIcon() {
        if (this._VIPIcon) return this._VIPIcon;

        const vips = this.vips;
        return this._VIPIcon = {
            components: {
                MiStar: CommonComponents.MiStar
            },
            props: ['user'],
            data() {
                return {
                    vips
                };
            },
            computed: {
                selected() {
                    return this.vips.includes(this.user.id);
                }
            },
            methods: {
                toggle() {
                    return PluginApi.plugin[this.selected ? 'removeVIP' : 'addVIP'](this.user.id);
                }
            },
            template: `<div class="VIP" :class="{selected}" @click.stop="toggle" style="cursor: pointer; margin-left: 8px;" :style="{fill: selected ? '#fac02e' : '#fff'}">
                <mi-star :size="24" />
            </div>`
        };
    }

};
