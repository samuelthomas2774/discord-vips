module.exports = (Plugin, { Api: PluginApi, Utils, CssUtils, WebpackModules, Patcher, monkeyPatch, Reflection, ReactComponents, Logger, VueInjector, Toasts, DiscordApi, CommonComponents }, Vendor) => class VIPs extends Plugin {

    onstart() {
        CssUtils.injectStyle(`#friends .tab-bar {
            overflow-x: auto;
            overflow-y: hidden;
        }

        #friends .tab-bar::-webkit-scrollbar {
            height: 0;
        }`);

        this.patchFriends();
        this.patchFriendRow();
        this.patchUserProfileModal();
    }

    onstop() {
        CssUtils.deleteAllStyles();
        Patcher.unpatchAll();

        for (let friends of document.querySelectorAll('#friends')) {
            Reflection(friends).forceUpdate();
        }
    }

    get bridge() {
        return {
            get vips() { return Utils.deepclone(PluginApi.plugin.vips) },
            getVIPs: () => this.vips.map(id => DiscordApi.User.fromId(id) || id),
            addVIP: this.addVIP.bind(this),
            removeVIP: this.removeVIP.bind(this),
            get groups() { return Utils.deepclone(PluginApi.plugin.groups) },
            getGroup: name => Utils.deepclone(this.getGroup(name)),
            addGroup: async name => Utils.deepclone(await this.addGroup(name)),
            showGroup: group => this.showGroup(this.getGroup(group.name)),
            removeGroup: group => this.removeGroup(this.getGroup(group.name)),
            getGroupMembers: group => group = this.getGroup(group.name) && group.members.map(id => DiscordApi.User.fromId(id) || id),
            isGroupMember: (group, id) => this.isGroupMember(this.getGroup(group.name), id),
            addToGroup: (group, id) => this.addToGroup(this.getGroup(group.name), id),
            removeFromGroup: (group, id) => this.removeFromGroup(this.getGroup(group.name), id),
            getUserGroups: id => Utils.deepclone(this.groups.filter(g => g.members.includes(id))),
            setUserGroups: (id, groups) => this.setUserGroups(id, groups.map(g => this.getGroup(g.name)))
        };
    }

    /**
     * Switches to the friends list.
     * @param {String} section The section to switch to (optional, see DiscordConstants.FriendsSections)
     */
    showFriends(section) {
        WebpackModules.NavigationUtils.transitionTo('/channels/@me');
        if (section) WebpackModules.getModulesByProperties('setSection').find(m => !m.open).setSection(section);
    }

    get vips() {
        if (!this.data.vips) this.data.vips = [];
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

    showGroup(group) {
        if (!this.groups.includes(group)) return;
        this.showFriends(`vips-${group.name}`);
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

    setUserGroups(id, groups) {
        let changed = false;

        for (let group of this.groups) {
            // User is not in group but should be
            if (groups.includes(group) && !group.members.includes(id)) {
                group.members.push(id);
                changed = true;
            }

            // User is in group but shouldn't be
            if (!groups.includes(group) && group.members.includes(id)) {
                Utils.removeFromArray(group.members, id);
                changed = true;
            }
        }

        if (!changed) return;

        for (let friends of document.querySelectorAll('#friends')) {
            Reflection(friends).forceUpdate();
        }

        return this.saveConfiguration();
    }

    async patchFriends() {
        const Friends = WebpackModules.getModuleByDisplayName('Friends');
        // const Friends = await ReactComponents.getComponent('Friends', {selector: '#friends'});

        monkeyPatch(Friends.prototype).after('render', (thisObject, args, returnValue, setReturnValue) => {
            const tabbarItems = returnValue.props.children[0].props.children.props.children;
            tabbarItems.push(tabbarItems[1]);

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

                    // for (let row of thisObject.state.rows._rows) {
                    //     if (!group.members.some(id => (row.type === 99 && row.key === id && row.__vips_group === group)) || (row.type !== 99)) {
                    //         let index = thisObject.state.rows._rows.indexOf(row);
                    //         if (index > -1) thisObject.state.rows._rows.splice(index, 1);
                    //     }
                    // }
                }

                if (!group.members.length) {
                    for (let row of thisObject.state.rows._rows) {
                        if (row.type !== 99 || row.__vips_group !== group) continue;
                        let index = thisObject.state.rows._rows.indexOf(row);
                        if (index > -1) thisObject.state.rows._rows.splice(index, 1);
                    }
                }

                const vipTab = WebpackModules.React.cloneElement(tabbarItems[2], {
                    children: group.name,
                    onClick: event => {
                        if (event.shiftKey) {
                            this.removeGroup(group);
                            // By the time this has been called the section will already have been selected
                        }
                    }
                });
                vipTab.key = `vips-${group.name}`;
                tabbarItems.push(vipTab);
            }

            tabbarItems.push(VueInjector.createReactElement(this.AddGroupButton));

            if (!thisObject.state.section.startsWith('vips-')) return;

            let VIPs = [];
            for (let row of thisObject.state.rows._rows) {
                if (row.type === 99 && thisObject.state.section.startsWith('vips-') && row.__vips_group && (thisObject.state.section.substr(5) === row.__vips_group.name)) VIPs.push(row);
            }

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

        monkeyPatch(FriendRow.component.prototype).after('render', (component, args, retVal, setReturnValue) => {
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

        monkeyPatch(UserProfileModal.component.prototype).after('renderHeader', (component, args, retVal) => {
            retVal.props.children.splice(2, 0, VueInjector.createReactElement(this.VIPIcon, {
                user: component.props.user
            }));
        });
    }

    async showAddGroupModal() {
        const set = PluginApi.Settings.createSet();
        set.headertext = 'Add group';

        const category = await set.addCategory('default');
        const setting = await category.addSetting({
            id: 'group-name',
            type: 'text',
            text: 'Group name',
            hint: 'Enter a name for the new group',
            value: ''
        });

        const modal = PluginApi.Modals.settings(set);

        // The settings modal will clone the set and merge it into the original later by default
        // Wait until it's merged into the original
        await Promise.race([
            set.once('settings-updated'),
            // Make sure the close event always throws
            modal.once('closed').then(() => {throw 'closed'})
        ]);

        Logger.log('Creating group', setting.value, set);

        set.setSaved();

        // For some reason the set doesn't get marked as saved properly
        // For now we can force close the modal to bypass the unsaved changes warning
        modal.close(true);

        // TODO: maybe add a message when a group already exists?
        return this.addGroup(setting.value);
    }

    get AddGroupButton() {
        if (this._AddGroupButton) return this._AddGroupButton;

        return this._AddGroupButton = {
            components: {
                MiPlus: CommonComponents.MiPlus
            },
            methods: {
                addGroup() {
                    return PluginApi.plugin.showAddGroupModal();
                }
            },
            template: `<div @click="addGroup" style="cursor: pointer; margin-left: 8px; fill: #fff;" v-tooltip="'Create group'">
                <mi-plus :size="18" />
            </div>`
        }
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
                },
                showGroups() {
                    return PluginApi.plugin.showGroupsModal(this.user.id);
                }
            },
            template: `<div class="VIP" :class="{selected}" @click.stop="toggle" @contextmenu.stop="showGroups" style="cursor: pointer; margin: 0 8px;" :style="{fill: selected ? '#fac02e' : '#fff'}" v-tooltip="'Right click to add to other groups'">
                <mi-star :size="24" />
            </div>`
        };
    }

    async showGroupsModal(user_id) {
        const user = DiscordApi.User.fromId(user_id);

        const set = PluginApi.Settings.createSet();
        set.headertext = `${user.tag}'s groups`;

        const category = await set.addCategory('default');
        const setting = await category.addSetting({
            id: 'groups',
            type: 'radio',
            // text: 'Groups',
            multi: true,
            fullwidth: true,
            value: this.groups.filter(g => g.members.includes(user_id)).map(g => g.name),
            options: this.groups.map(g => ({
                id: g.name,
                text: g.name,
                value: g.name
            }))
        });

        const modal = PluginApi.Modals.settings(set);

        // The settings modal will clone the set and merge it into the original later by default
        // Wait until it's merged into the original
        await Promise.race([
            set.once('settings-updated'),
            // Make sure the close event always throws
            modal.once('closed').then(() => {throw 'closed'})
        ]);

        Logger.log('Updating user groups', setting.value, set);

        set.setSaved();
        // For some reason the set doesn't get marked as saved properly
        // For now we can force close the modal to bypass the unsaved changes warning
        modal.close(true);

        return this.setUserGroups(user_id, setting.value.map(name => this.getGroup(name)));
    }

};
