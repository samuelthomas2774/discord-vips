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

    async patchFriends() {
        const Friends = WebpackModules.getModuleByDisplayName('Friends');
        // const Friends = await ReactComponents.getComponent('Friends', {selector: '#friends'});

        Logger.log('Friends', global._Friends = Friends);

        monkeyPatch(Friends.prototype).after('render', (thisObject, args, returnValue, setReturnValue) => {
            Logger.log('Friends render called', thisObject, args, returnValue);

            for (let id of this.vips) {
                // const user = WebpackModules.UserStore.getUser(id);
                const user = DiscordApi.User.fromId(id);

                if (!thisObject.state.rows._rows[0] || !user) continue;

                let mutualGuilds = [];
                // for (let guild of Object.values(WebpackModules.GuildStore.getGuilds())) {
                //     if (WebpackModules.GuildMemberStore.isMember(guild.id, id)) mutualGuilds.push(guild);
                // }
                for (let guild of DiscordApi.guilds) {
                    if (guild.isMember(id)) mutualGuilds.push(guild.discordObject);
                }

                let objectRow = new (thisObject.state.rows._rows[0].constructor)({
                    activity: WebpackModules.UserStatusStore.getActivity(id),
                    key: id,
                    mutualGuilds: mutualGuilds.slice(0, 5),
                    mutualGuildsLength: mutualGuilds.length,
                    status: WebpackModules.UserStatusStore.getStatus(id),
                    type: 99,
                    user: user.discordObject,
                    usernameLower: user.usernameLowerCase
                });

                let found = thisObject.state.rows._rows.find(row => row.key === objectRow.key && row.type === objectRow.type);
                if (!found) thisObject.state.rows._rows.push(objectRow);
                else Object.assign(found, objectRow);

                for (let row of thisObject.state.rows._rows) {
                    if (!this.vips.some(id => (row.type === 99 && row.key === id)) || (row.type !== 99)) {
                        let index = thisObject.state.rows._rows.indexOf(row);
                        // if (index > -1) thisObject.state.rows._rows.splice(index, 1);
                    }
                }
            }

            if (!this.vips.length) {
                for (let row of thisObject.state.rows._rows) {
                    if (row.type !== 99) continue;
                    let index = thisObject.state.rows._rows.indexOf(row);
                    if (index > -1) thisObject.state.rows._rows.splice(index, 1);
                }
            }

            let sections = returnValue.props.children[0].props.children.props.children;
            sections.push(sections[1]);
            const vipTab = WebpackModules.React.cloneElement(sections[2], {children: 'VIP'});
            vipTab.key = 'VIP';
            sections.push(vipTab);

            let VIPs = [];
            for (let row of thisObject.state.rows._rows) {
                if (row.type === 99) VIPs.push(row);
            }

            if (thisObject.state.section !== 'VIP') return;

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
            // template: `<div class="VIP" :class="{selected}" @click="toggle" style="-webkit-mask-image: url('https://cdn.iconscout.com/public/images/icon/free/png-24/star-bookmark-favorite-shape-rank-like-378019f0b9f54bcf-24x24.png'); cursor: pointer; height: 24px; margin-left: 8px; width: 24px;" :style="{backgroundColor: selected ? '#fac02e' : '#fff'}"></div>`
            template: `<div class="VIP" :class="{selected}" @click="toggle" style="cursor: pointer; margin-left: 8px;" :style="{fill: selected ? '#fac02e' : '#fff'}">
                <mi-star :size="24" />
            </div>`
        };
    }

};
