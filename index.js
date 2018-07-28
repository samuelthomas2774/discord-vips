let userModal;

module.exports = (Plugin, { Api: PluginApi, Utils, WebpackModules, Patcher, Reflection, ReactComponents, Logger, VueInjector }, Vendor) => class VIPs extends Plugin {

    // getName() { return "VIPs"; }
    // getDescription() { return "Adds an extra section to the friends list where you can add your most important contacts on Discord (Bots included). Add users by right clicking their name, opening their profile and then clicking on the star."; }
    // getVersion() { return "1.0.2"; }
    // getAuthor() { return "Green"; }
    // getUpdateLink() { return "https://raw.githubusercontent.com/Greentwilight/VIPs/master/VIPs.plugin.js"; }

    // load() {}

    // onstart() {
    //     var libraryScript = document.getElementById('zeresLibraryScript');
    //     if (libraryScript) libraryScript.parentElement.removeChild(libraryScript);
    //     libraryScript = document.createElement("script");
    //     libraryScript.setAttribute("type", "text/javascript");
    //     libraryScript.setAttribute("src", "https://rauenzi.github.io/BetterDiscordAddons/Plugins/PluginLibrary.js");
    //     libraryScript.setAttribute("id", "zeresLibraryScript");
    //     document.head.appendChild(libraryScript);
    //     if (typeof window.ZeresLibrary !== "undefined") this.initialize();
    //     else libraryScript.addEventListener("load", () => { this.initialize(); });
    // }

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

    onstart() {
        // this.initialized = true;
        // PluginUtilities.checkForUpdate(this.getName(), this.getVersion(), this.getUpdateLink());

        this.patchFriends();
        this.patchUserProfileModal();
    }

    async patchFriends() {
        const Friends = WebpackModules.getModuleByDisplayName('Friends');
        // const Friends = await ReactComponents.getComponent('Friends', {selector: '#friends'});

        Logger.log('Friends', global._Friends = Friends);

        Patcher.after(Friends.prototype, 'render', (thisObject, args, returnValue, setReturnValue) => {
            Logger.log('Friends render called', thisObject, args, returnValue);

            // let data = PluginUtilities.loadData("VIPs", "VIPs", "");
            // let ids = this.vips;

            for (let id of this.vips) {
                const user = WebpackModules.UserStore.getUser(id);

                if (!thisObject.state.rows._rows[0] || !user) continue;

                let mutualGuilds = [];
                // Object.values(WebpackModules.GuildStore.getGuilds()).forEach((guild) => {
                //     if(DiscordModules.GuildMemberStore.isMember(guild.id, id)){ mutualGuilds.push(guild); }
                // });
                for (let guild of Object.values(WebpackModules.GuildStore.getGuilds())) {
                    if (WebpackModules.GuildMemberStore.isMember(guild.id, id)) mutualGuilds.push(guild);
                }

                let objectRow = new (thisObject.state.rows._rows[0].constructor)({
                    activity: WebpackModules.UserStatusStore.getActivity(id),
                    key: id,
                    mutualGuilds,
                    mutualGuildsLength: mutualGuilds.length,
                    status: WebpackModules.UserStatusStore.getStatus(id),
                    type: 99,
                    user,
                    usernameLower: user.usernameLowerCase
                });

                let found = thisObject.state.rows._rows.find((row) => row.key == objectRow.key && row.type == objectRow.type);
                if (!found) thisObject.state.rows._rows.push(objectRow);
                else Object.assign(found, objectRow);

                // thisObject.state.rows._rows.forEach((row) => {
                for (let row of thisObject.state.rows._rows) {
                    if (!this.vips.some((id) => (row.type == 99 && row.key == id)) || (row.type != 99)) {
                        let index = thisObject.state.rows._rows.indexOf(row);
                        // if (index > -1) thisObject.state.rows._rows.splice(index, 1);
                    }
                // });
                }
            }

            if (!this.vips.length) {
                // thisObject.state.rows._rows.forEach((row) => {
                for (let row of thisObject.state.rows._rows) {
                    if (row.type !== 99) continue;
                    let index = thisObject.state.rows._rows.indexOf(row);
                    if (index > -1) thisObject.state.rows._rows.splice(index, 1);
                // });
                }
            }

            let sections = returnValue.props.children[0].props.children.props.children;
            sections.push(sections[1]);
            const vipTab = WebpackModules.React.cloneElement(sections[2], {children: 'VIP'});
            vipTab.key = 'VIP';
            sections.push(vipTab);

            let VIPs = [];
            // thisObject.state.rows._rows.forEach((row) => {
            //     if(row.type == 99){ VIPs.push(row); }
            // });
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

        Patcher.instead(Friends.prototype, 'componentDidUpdate', (thisObject, args) => {
            let vipRowNumber = 0;
            if (thisObject.state.section !== 'VIP') return;

            // thisObject.state.rows._rows.forEach((row) => {
            for (let row of thisObject.state.rows._rows) {
                if (row.type !== 99) continue;

                let additionalActions = document.querySelectorAll(".friends-column-actions-visible")[vipRowNumber];
                let wrapper = document.createElement('div');
                wrapper.innerHTML = `<div class="VIP" style="-webkit-mask-image: url('https://cdn.iconscout.com/public/images/icon/free/png-24/star-bookmark-favorite-shape-rank-like-378019f0b9f54bcf-24x24.png'); cursor: pointer; height: 24px; margin-left: 8px; width: 24px; background-color: #fff;"></div>`;

                if (additionalActions && additionalActions.childNodes.length == 0) {
                    additionalActions.appendChild(wrapper.firstChild);
                }

                let vip = additionalActions.querySelector(".VIP");
                if (!vip) continue;

                // let data = PluginUtilities.loadData("VIPs", "VIPs", "");
                let id = row.user.id;

                if (this.vips.includes(id)) {
                    vip.classList.add("selected");
                    vip.style.backgroundColor = "#fac02e";
                }

                if (userModal && document.querySelectorAll(".friends-column-actions-visible").length != 1) {
                    if (document.querySelectorAll(".friends-column-actions-visible").length - 2 == vipRowNumber) userModal = false;
                } else {
                    vip.addEventListener("click", e => {
                        e.stopPropagation();
                        // data = PluginUtilities.loadData("VIPs", "VIPs", "");
                        // ids = this.vips;
                        if (vip.classList.contains("selected")) {
                            // if (ids.indexOf(id) >= 0) ids.splice(ids.indexOf(id), 1);
                            // Utils.removeFromArray(this.vips, id);
                            this.removeVIP(id);
                            vip.classList.remove("selected");
                            vip.style.backgroundColor = "#fff";
                        } else {
                            // if (ids.indexOf(id) < 0) ids.push(id);
                            // if (!this.vips.find(i => i === id)) this.vips.push(id);
                            this.addVIP(id);
                            vip.classList.add("selected");
                            vip.style.backgroundColor = "#fac02e";
                        }
                        // PluginUtilities.saveData("VIPs", "VIPs", {ids});
                        // this.saveConfiguration();
                    });
                }

                vipRowNumber++;
            // })
            }
        });

        // if (document.querySelector(".friends-table")){ getOwnerInstance(document.querySelector(".friends-table")).forceUpdate(); }

        for (let friends of document.querySelectorAll('#friends')) {
            Reflection(friends).forceUpdate();
        }

        // PluginUtilities.showToast(this.getName() + " " + this.getVersion() + " has started.");
        // DOMObserver.subscribe(this.observer.bind(this));
        // DOMObserver.subscribe(this.modalObserver, mutation => {
        //     // return
        //
        //     if (!e.addedNodes || !e.addedNodes.length) return;
        //     if (!e.addedNodes[0].classList || !e.addedNodes[0].classList.contains("modal-1UGdnR")) return;
        // }, this);
        // DOMObserver.subscribeToQuerySelector(this.modalObserver, '.modal-1UGdnR', this);
    }

    async patchUserProfileModal() {
        const UserProfileModal = await ReactComponents.getComponent('UserProfileModal');

        Logger.log('Found UserProfileModal', UserProfileModal);

        Patcher.after(UserProfileModal.component.prototype, 'renderHeader', (component, args, retVal) => {
            retVal.props.children.push(VueInjector.createReactElement(this.VIPIcon, {
                user: component.props.user
            }));
        });
    }

    get VIPIcon() {
        if (this._VIPIcon) return this._VIPIcon;

        const vips = this.vips;
        return this._VIPIcon = {
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
            template: `<div class="VIP" :class="{selected}" @click="toggle" style="-webkit-mask-image: url('https://cdn.iconscout.com/public/images/icon/free/png-24/star-bookmark-favorite-shape-rank-like-378019f0b9f54bcf-24x24.png'); cursor: pointer; height: 24px; margin-left: 8px; width: 24px;" :style="{backgroundColor: selected ? '#fac02e' : '#fff'}"></div>`
        };
    }

    modalObserver(mutation) {
        let popout = document.querySelector(".noWrap-3jynv6.root-SR8cQa");
        let actions = document.querySelector(".additionalActionsIcon-1FoUlE");

        if (!popout || !actions) return;

        // let data = PluginUtilities.loadData("VIPs", "VIPs", "");
        // let ids = this.vips;
        // let id = getOwnerInstance(popout).props.user.id;
        let id = Reflection(popout).props.user.id;

        let wrapper = document.createElement('div');
        wrapper.innerHTML = `<div class="VIP" style="-webkit-mask-image: url('https://cdn.iconscout.com/public/images/icon/free/png-24/star-bookmark-favorite-shape-rank-like-378019f0b9f54bcf-24x24.png'); cursor: pointer; height: 24px; margin-left: 8px; width: 24px; background-color: #fff;"></div>`;

        // DOMUtilities.insertAfter(wrapper.firstChild, actions);
        // wrapper.firstChild.insertBefore(actions, wrapper.firstChild.nextElementSibling);
        actions.parentElement.insertBefore(wrapper.firstChild, actions.nextElementSibling);

        let vip = popout.querySelector(".VIP");
        if (!vip) return;

        if (this.vips.includes(id)) {
            vip.classList.add("selected");
            vip.style.backgroundColor = "#fac02e";
        }

        vip.addEventListener("click", () => {
            if (this.vips.includes(id)) {
                // if (ids.indexOf(id) >= 0) ids.splice(ids.indexOf(id), 1);
                // Utils.removeFromArray(this.vips, id);
                // PluginUtilities.saveData("VIPs", "VIPs", {ids});
                // this.saveConfiguration();
                this.removeVIP(id);
                vip.classList.remove("selected");
                vip.style.backgroundColor = "#fff";
            } else {
                // if(ids.indexOf(id) < 0){ ids.push(id); }
                // if (!this.vips.find(i => i === id)) this.vips.push(id);
                // PluginUtilities.saveData("VIPs", "VIPs", {ids});
                // this.saveConfiguration();
                this.addVIP(id);
                vip.classList.add("selected");
                vip.style.backgroundColor = "#fac02e";
            }

            if (document.querySelector(".friends-table") && (userModal = true)){
                // getOwnerInstance(document.querySelector(".friends-table")).forceUpdate();
                for (let friends of document.querySelectorAll('.friends-table')) {
                    Reflection(friends).forceUpdate();
                }
                userModal = false;
            }
        });
    }

    onstop() {
        Patcher.unpatchAll();
        // DOMObserver.unsubscribeAll();

        for (let friends of document.querySelectorAll('#friends')) {
            Reflection(friends).forceUpdate();
        }
    }

};
