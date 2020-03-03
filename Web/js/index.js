var view = getCookie("view");
var json = "";

var blinkAlert = [];

var dashboardHidden = [];
var dashboardAnalog = [];
var dashboardDigital = [];
var adjustHeight;

var serialStream = "";
var CANBusRead = []; //reads incoming CAN messages
var streamHttpRequest;
var streamAnalogTimer;
var streamDigitalTimer;

var formTimer;

var _alert;
var iconic;

document.addEventListener("DOMContentLoaded", function(event)
{
    iconic = IconicJS();
    _alert = document.getElementById("alert");

    var safety = getCookie("safetyD");
    if (safety === undefined) {
       
        var lightboxBody = document.getElementById("lightboxBody");
        var lightboxTitle = document.getElementById("lightboxTitle");
            
        var svg = document.createElement("img");
        svg.classList.add("iconic");
        svg.classList.add("svg-orange");
        svg.style.width = "64px";
        svg.style.height = "64px";
        svg.src = "svg/alert.svg";
        lightboxTitle.appendChild(svg);
        iconic.inject(svg);

        var warning = document.createElement("h1");
        warning.classList.add("formtext");
        warning.append("WARNING");
        lightboxTitle.appendChild(warning);

        var span = document.createElement("span");
        var btn = document.createElement("input");
        btn.type = "button";
        btn.value = "OK";

        warning = document.createElement("h1");
        addText(warning,"Taking your eyes off the road too long or too often while using this system <br>could cause a crash resulting in injury or death to you or others.<br><br>Focus your attention on driving.<br><br>");
        
        span.appendChild(warning);
        span.appendChild(btn);

        lightboxBody.appendChild(span);

        btn.onclick = function (e) {
            setCookie("safetyD", 1, 1);
            window.location = "#close";
        };

        window.location = "#openModal";
    }

    if (view === undefined) {
        view = "open.json";
    }

    ajaxReceive("views/" + view, function(data)
    {
        //console.log(data);
        json = data;

        document.body.style.backgroundColor = data.backgroundColor;
        document.body.style.backgroundImage = "url('views/bg/" + data.backgroundImage + "')";
        
        buildView("front");
        renderView("front");
        animateView();

        setTimeout(function() {
            streamInit(json.serial,json.canbus);
        }, 4000);

    }, function(xhr) {
        console.error(xhr);
        setCookie("view", "open.json", 360);
        location.reload();
    });
});

function addText(node,text)
{
    var t=text.split(/\s*<br ?\/?>\s*/i), i;
     if(t[0].length>0){
       node.appendChild(document.createTextNode(t[0]));
     }
     for(i=1;i<t.length;i++){
        node.appendChild(document.createElement('BR'));
        if(t[i].length>0){
          node.appendChild(document.createTextNode(t[i]));
        }
    }
};

function detectSeperator(text)
{
    var s = [",", ":", ";"];
    
    for (i = 0; i < s.length; i++) {
        if(text.indexOf(s[i]) !== -1)
            return s[i];
    }

    return "";
};

function animateView()
{
    document.gauges.forEach(function(gauge) {

        if (gauge.options.enabled == true)
        {
            //console.log("... animate " + gauge.options.renderTo);

            gauge.value = gauge.options.maxValue;

            setTimeout(function() {
                gauge.value = gauge.options.minValue;
            }, gauge.options.animationDuration*1.5);
        }
    });
};

function dynamicGaugeWidth(g)
{
    if(g.length > 4) { //max 4 gauges per row
        return Math.round(getWidth() / 4) - 10;
    }else{
        return Math.round(getWidth() / g.length);
    }
};

function sizeView(view)
{
    if(view === "front")
    {
        var w = dynamicGaugeWidth(dashboardAnalog);
        var dynamicHeight = getHeight();
        
        //alert(getHeight() + " " + w + ":" + h);
        if(dashboardAnalog.length > 4 || dashboardDigital.length > 4) {
            dynamicHeight /= 2;
        }

        if(json.alerts.length > 0)
            dynamicHeight -= 200;

        for (var i = 0, l = document.gauges.length; i < l; i++) {

            var gauge = document.gauges[i];
            //console.log(gauge);

            if (gauge.options.enabled == true) {

                //console.log("... adjust size " + gauge.options.renderTo);

                gauge.options.width = w;
                gauge.options.height = dynamicHeight;
                gauge.update();

                /*
                var td = document.getElementById(gauge.options.renderTo);
                td.parentElement.width = gauge.options.width;
                td.parentElement.height = gauge.options.height;
                */
            }
        }

        /*
        var maxH = [];
        for (var i = 0; i < json.analog.length; i++)
        {
            var t = document.getElementById("canvasAnalogIndex" + i);
            console.log("canvasAnalogIndex" + i + " height=" + t.height);
            maxH.push(t.height);
        }
        dashboardHeight = Math.max.apply(null,maxH);
        */

    }else if (view === "back") {

        var h = Math.round(getHeight() / 5);
        var backMenu = document.getElementById("backMenu");
        var backAvailable = document.getElementById("backAvailable");
        var backAnalogSelected = document.getElementById("backAnalogSelected");
        var backDigitalSelected = document.getElementById("backDigitalSelected");

        backAvailable.parentElement.height = h;

        for (var i = 0; i < dashboardHidden.length; i++) {
            var img = document.getElementById("_" + dashboardHidden[i].renderTo);
            img.width = backAvailable.parentElement.clientHeight;
        }

        if(backAnalogSelected != undefined)
        {
            backAnalogSelected.parentElement.height = Math.round(getHeight() - backMenu.clientHeight - backAvailable.clientHeight);

            var w = dynamicGaugeWidth(dashboardAnalog);
            for (var i = 0; i < dashboardAnalog.length; i++) {
                var img = document.getElementById("_" + dashboardAnalog[i].renderTo);
                img.width = w * 0.8; //- backMenu.height;
            }
        }

        if(backDigitalSelected != undefined)
        {
            backDigitalSelected.parentElement.height = Math.round(getHeight() - backMenu.clientHeight - h);
        
            //w = dynamicGaugeWidth(dashboardDigital);
            for (var i = 0; i < dashboardDigital.length; i++) {
                var img = document.getElementById("_" + dashboardDigital[i].renderTo);
                img.width = w * 0.5; //backDigitalSelected.clientHeight;
            }
        }
    }
};

function buildMenu()
{
    ajaxReceive("js/menu.json", function(data)
    {
        console.log(data);

        var menu = document.getElementById("backMenu");
        //menu.innerHTML = "";

        var tr = document.createElement("tr");

        for (var key in data.menu)
        {
            console.log(data.menu[key].icon);

            var td = document.createElement("td");
            var span = document.createElement("span");
            var svg = document.createElement("img");

            //svg.dataset.color = "";
            svg.classList.add("iconic");
            svg.classList.add("svg-grey");
            svg.style.width = "50px";
            svg.style.height = "50px";
            svg.src = "svg/" + data.menu[key].icon + ".svg";
            //svg.setAttribute("data-src", "svg/" + key + ".svg");
            span.style.position = "relative"; 
            span.style.zIndex = "1";
            span.id = "menu_" + data.menu[key].icon;
            span.title = data.menu[key].title;
            span.href = data.menu[key].href;
            span.appendChild(svg);
            iconic.inject(svg);

            span.onclick = function (e) {
                //console.log(this);
                //console.log(this.children[1].src);
                e.preventDefault();
                e.stopPropagation();

                var lightboxBody = document.getElementById("lightboxBody");
                var lightboxTitle = document.getElementById("lightboxTitle");
                lightboxBody.innerHTML = "";
                lightboxTitle.innerHTML = this.title;

                if(this.id =="menu_background")
                {
                    //TODO: loop through all background
                    ajaxReceive("views/bg/index.json", function(data)
                    {
                        var ul = document.createElement("ul");
                        ul.classList.add("slides");

                        var nav_dots = document.createElement("li");
                        nav_dots.classList.add("nav-dots");

                        for (var u = 0; u < data.index.length; u++)
                        {
                            var div = document.createElement("div");
                            var li = document.createElement("li");
                            var nav = document.createElement("div");
                            var label_prev = document.createElement("label");
                            var label_next = document.createElement("label");
                            var label = document.createElement("label");
                            var input = document.createElement("input");
                            var img = document.createElement("img");

                            div.classList.add("slide");
                            li.classList.add("slide-container");
                            nav.classList.add("nav");
                            label.classList.add("nav-dot");
                            label_prev.classList.add("prev");
                            label_next.classList.add("next");
                            
                            var input = document.createElement("input");
                            input.type = "radio";
                            input.name = "radio-btn";
                            input.id = "img-" + u;
                            input.checked = true;

                            img.src = "views/bg/" + data.index[u];
                            div.appendChild(img);
                            li.appendChild(div);

                            label.setAttribute("for", "img-" + u);
                            label.id = "img-dot-" + u;
                            
                            var prev = (u-1);
                            if(u == 0)
                                prev = (data.index.length-1);
                            label_prev.innerHTML = "&#x2039";
                            label_prev.setAttribute("for", "img-" + prev);
                            nav.appendChild(label_prev);

                            var next = (u+1);
                            if(u == data.index.length-1)
                                next = 0;
                            label_next.innerHTML = "&#x203a;";
                            label_next.setAttribute("for", "img-" + next);
                            nav.appendChild(label_next);

                            li.appendChild(nav);
                            ul.appendChild(input);
                            ul.appendChild(li);

                            img.onclick = function (e) {
                                //console.log(this.src);
                                json.backgroundImage = this.src;
                                document.body.style.backgroundImage = "url('views/bg/" + this.src + "')";
                                window.location = "#close";
                            };
                        }
                        ul.appendChild(nav_dots);
                        lightboxBody.appendChild(ul);
                    });
                }
                else if(this.id =="menu_view")
                {
                    ajaxReceive("views/index.json", function(d) {

                        var center = document.createElement("center");
                        var select = document.createElement("select");

                        for (var key in d.index) {
                            var xhr = new XMLHttpRequest();
                            xhr.open("GET", "views/" + d.index[key], false);
                            xhr.onload = function () {
                                //console.log(d.index[key]);
                                var j = JSON.parse(this.responseText);
                                var opt = document.createElement('option');

                                opt.value = d.index[key];
                                if(opt.value == view) {
                                    opt.selected = true;
                                }else{
                                    opt.selected = false;
                                }
                                opt.append(j.dashboard);
                                select.appendChild(opt);
                            };
                            xhr.send();
                        }
                        center.appendChild(select);
                        lightboxBody.appendChild(center);

                        select.onchange = function () {
                            console.log(this.value);
                            window.location = "#close";
                            setCookie("view", this.value, 360);
                            location.reload();
                        };
                    });
                }
                else if(this.id =="menu_opendbc")
                {
                    ajaxReceive("opendbc/index.json", function(data) {
                        //console.log(data);
                        if(data.index === 0) {
                            var div = document.createElement("div");
                            div.append("No DBC Files Found.");
                            lightboxBody.appendChild(div);
                        }else{
                            var table = document.createElement("table");
                            table.border = 0;

                            for (var key in data.index) {
                                var tr = document.createElement("tr");

                                var td = document.createElement("td");
                                td.append(data.index[key]);
                                tr.appendChild(td);

                                var a = document.createElement("a");
                                a.href = "opendbc/delete?file=" + data.index[key];
                                a.append("X");
                                td = document.createElement("td");
                                td.appendChild(a);
                                tr.appendChild(td);

                                table.appendChild(tr);
                            }
                            lightboxBody.appendChild(table);
                        }
                    });
                }
                else if(this.id =="menu_wifi")
                {
                    var mode_ap = document.createElement("input");
                    var mode_ap_text = document.createElement("span");
                    var mode_client = document.createElement("input");
                    var mode_client_text = document.createElement("span");

                    var ssid_hidden = document.createElement("input");
                    var ssid_hidden_checkbox = document.createElement("input");
                    var ssid_hidden_text = document.createElement("span");

                    var channel = document.createElement("select");
                    var channel_text = document.createElement("span");

                    var ssid = document.createElement("input");
                    var password = document.createElement("input");
                    var passwordC = document.createElement("input");

                    var log = document.createElement("input");
                    var log_checkbox = document.createElement("input");
                    var log_text = document.createElement("span");
                    var log_interval = document.createElement("input");

                    mode_ap.type = "radio";
                    mode_ap.name = "WiFiMode";
                    mode_ap.value = 0;
                    mode_ap_text.append("WiFi Access Point");
                    mode_ap_text.classList.add("formtext");

                    mode_client.type = "radio";
                    mode_client.name = "WiFiMode";
                    mode_client.value = 1;
                    mode_client_text.append("WiFi Client");
                    mode_client_text.classList.add("formtext");

                    ssid_hidden.type = "hidden";
                    ssid_hidden.name = "WiFiHidden";
                    ssid_hidden.value = 0;
                    ssid_hidden_checkbox.type = "checkbox";
                    ssid_hidden_checkbox.name = "WiFiHiddenCheckbox";
                    ssid_hidden_text.append("Hidden SSID");
                    ssid_hidden_text.classList.add("formtext");

                    channel.name = "WiFiChannel";
                    for (i = 1; i <= 11; i++) { 
                        var opt = document.createElement('option');
                        opt.append(i);
                        channel.appendChild(opt);
                    }

                    channel_text.append("Channel");
                    channel_text.classList.add("formtext");

                    ssid.type = "text";
                    ssid.name = "WiFiSSID";
                    ssid.placeholder = "SSID";

                    password.type = "password";
                    password.name = "WiFiPassword";
                    password.placeholder = "Password (WPA2)";
                    passwordC.type = "password";
                    passwordC.name = "WiFiPasswordConfirm";
                    passwordC.placeholder = "Password Confirm";

                    log.type = "hidden";
                    log.name = "EnableLOG";
                    log.value = 0;
                    log_checkbox.type = "checkbox";
                    log_checkbox.name = "EnableLOGCheckbox";
                    log_text.append("Enable Data Collection");
                    log_text.classList.add("formtext");

                    log_interval.type = "text";
                    log_interval.name = "EnableLOGInterval";
                    log_interval.placeholder = "Log Interval (seconds)";

                    ssid_hidden_checkbox.onchange = function () {
                        if(this.checked == true){
                            ssid_hidden.value = 1;
                        }else{
                            ssid_hidden.value = 0;
                        }
                    };

                    log_checkbox.onchange = function () {
                        if(this.checked == true){
                            log.value = 1;
                        }else{
                            log.value = 0;
                        }
                    };

                    ajaxReceive("nvram", function(data)
                    {
                        //console.log(data);
                        if(Object.keys(data).length > 0) {
                            if(data["nvram0"] == "0") {
                                mode_ap.checked = true;
                            }else{
                                mode_client.checked = true;
                            }
                            if(data["nvram1"] == "1") {
                                ssid_hidden.value = 1;
                                ssid_hidden_checkbox.checked = true;
                            }
                            channel.value = data["nvram2"];
                            ssid.value = data["nvram3"];
                            if(data["nvram5"] == "1") {
                                log.value = 1;
                                log_checkbox.checked = true;
                            }
                            log_interval.value = data["nvram6"];
                        }
                    });

                    var nvram = document.createElement("form");
                    nvram.method="POST";
                    nvram.action="nvram";
                    nvram.appendChild(mode_ap);
                    nvram.appendChild(mode_ap_text);
                    nvram.appendChild(mode_client);
                    nvram.appendChild(mode_client_text);
                    nvram.appendChild(document.createElement("br"));
                    nvram.appendChild(document.createElement("br"));
                    nvram.appendChild(ssid_hidden);
                    nvram.appendChild(ssid_hidden_checkbox);
                    nvram.appendChild(ssid_hidden_text);
                    nvram.appendChild(channel);
                    nvram.appendChild(channel_text);
                    nvram.appendChild(ssid);
                    nvram.appendChild(password);
                    nvram.appendChild(passwordC);
                    nvram.appendChild(log);
                    nvram.appendChild(log_checkbox);
                    nvram.appendChild(log_text);
                    nvram.appendChild(log_interval);
                    lightboxBody.appendChild(nvram);

                    const typeWiFiHandler = function(e) {
                        //console.log(e.target.value);

                        clearTimeout(formTimer);
                        formTimer = setTimeout(function()
                        {
                            if(ssid.value.length < 1) {
                                alert("SSID cannot be empty");
                            }else if(password.value.length < 8) {
                                alert("WPA2 password must be greater than 8");
                            }else if(password.value != passwordC.value) {
                                alert("Confirm password must match");
                            }else{
                                //Avoid POST sending checkbox values (javascript anomaly sends only 'on' state)
                                ssid_hidden_checkbox.checked = false;
                                log_checkbox.checked = false;
                                nvram.submit();
                            }
                        }, 2000);
                    };

                    passwordC.addEventListener("input", typeWiFiHandler);
                }
                else if(this.id =="menu_network")
                {
                    var mode_ap = 0;
                    var dhcp = document.createElement("input");
                    var dhcp_checkbox = document.createElement("input");
                    var dhcp_text = document.createElement("span");

                    var ip = document.createElement("input");
                    var subnet = document.createElement("input");
                    var gateway = document.createElement("input");
                    var dns = document.createElement("input");

                    dhcp.type = "hidden";
                    dhcp.name = "WiFiDHCP";
                    dhcp.value = 0;
                    dhcp_checkbox.type = "checkbox";
                    dhcp_checkbox.name = "WiFiDHCPCheckbox";
                    dhcp_text.append("Enable DHCP");
                    dhcp_text.classList.add("formtext");

                    ip.type = "text";
                    ip.name = "WiFiIP";
                    ip.placeholder = "IPv4 Address (192.168.0.2)";

                    subnet.type = "text";
                    subnet.name = "WiFiSubnet";
                    subnet.placeholder = "Subnet Mask (255.255.255.0)";

                    gateway.type = "text";
                    gateway.name = "WiFiGateway";
                    gateway.placeholder = "Gateway Address (192.168.0.1)";

                    dns.type = "text";
                    dns.name = "WiFiDNS";
                    dns.placeholder = "DNS Address (8.8.8.8)";

                    ajaxReceive("nvram", function(data)
                    {
                        //console.log(data);
                        if(Object.keys(data).length > 0) {
                            if(data["nvram0"] == "1")
                                mode_ap = 1;
                        }
                    });

                    ajaxReceive("nvram?network=1", function(data)
                    {
                        //console.log(data);
                        if(Object.keys(data).length > 0) {
                            if(data["nvram7"] == "1") {
                                dhcp.value = 1;
                                dhcp_checkbox.checked = true;
                                ip.disabled = true;
                                subnet.disabled = true;
                                gateway.disabled = true;
                                dns.disabled = true;
                            }else{
                                dhcp.value = 0;
                                dhcp_checkbox.checked = false;
                            }
                            ip.value = data["nvram8"];
                            subnet.value = data["nvram9"];
                            gateway.value = data["nvram10"];
                            dns.value = data["nvram11"];
                        }
                    });

                    var nvram = document.createElement("form");
                    nvram.method="POST";
                    nvram.action="nvram";
                    nvram.appendChild(dhcp);
                    nvram.appendChild(dhcp_checkbox);
                    nvram.appendChild(dhcp_text);
                    nvram.appendChild(document.createElement("br"));
                    nvram.appendChild(document.createElement("br"));
                    nvram.appendChild(ip);
                    nvram.appendChild(subnet);
                    nvram.appendChild(gateway);
                    nvram.appendChild(dns);
                    lightboxBody.appendChild(nvram);

                    dhcp_checkbox.onchange = function () {
                        if(this.checked == true){
                            dhcp.value = 1;
                            ip.disabled = true;
                            subnet.disabled = true;
                            gateway.disabled = true;
                            dns.disabled = true;
                            if(mode_ap == 0) {
                                alert("WARNING: DHCP works only in WiFi Client mode");
                            }
                            typeNetworkHandler();
                        }else{
                            dhcp.value = 0;
                            ip.disabled = false;
                            subnet.disabled = false;
                            gateway.disabled = false;
                            dns.disabled = false;
                        }
                    };

                    const typeNetworkHandler = function(e) {
                        //console.log(e.target.value);

                        clearTimeout(formTimer);
                        formTimer = setTimeout(function()
                        {
                            if(dhcp_checkbox.checked == false) {
                                if(ip.value.length < 1 || ip.value.includes(".", 3) == false) {
                                    alert("IPv4 address invalid");
                                    return;
                                }else if(subnet.value.length < 1 || subnet.value.includes(".", 3) == false) {
                                    alert("Subnet mask invalid");
                                    return;
                                }else if(gateway.value.length < 1 || gateway.value.includes(".", 3) == false) {
                                    alert("Gateway address invalid");
                                    return;
                                }
                            }
                            //Avoid POST sending checkbox values (javascript anomaly sends only 'on' state)
                            dhcp_checkbox.checked = false;
                            nvram.submit();
                        }, 3800);
                    };

                    ip.addEventListener("input", typeNetworkHandler);
                    subnet.addEventListener("input", typeNetworkHandler);
                    gateway.addEventListener("input", typeNetworkHandler);
                    dns.addEventListener("input", typeNetworkHandler);
                }
                else if(this.id =="menu_email")
                {
                    var notify = document.createElement("input");
                    var notify_checkbox = document.createElement("input");
                    var notify_text = document.createElement("span");

                    var email = document.createElement("input");
                    var smtp = document.createElement("input");
                    var username = document.createElement("input");
                    var password = document.createElement("input");

                    notify.type = "hidden";
                    notify.name = "WiFiNotify";
                    notify.value = 0;
                    notify_checkbox.type = "checkbox";
                    notify_checkbox.name = "WiFiNotifyCheckbox";
                    notify_text.append("Enable Email Notifications");
                    notify_text.classList.add("formtext");

                    email.type = "text";
                    smtp.type = "text";
                    username.type = "text";
                    password.type = "password";

                    email.placeholder = "Email";
                    smtp.placeholder = "Email Server (SMTP)";
                    username.placeholder = "Email Username";
                    password.placeholder = "Email Password";

                    var nvram = document.createElement("form");
                    nvram.method="POST";
                    nvram.action="nvram";
                    nvram.appendChild(notify);
                    nvram.appendChild(notify_checkbox);
                    nvram.appendChild(notify_text);
                    nvram.appendChild(document.createElement("br"));
                    nvram.appendChild(document.createElement("br"));
                    nvram.appendChild(email);
                    nvram.appendChild(smtp);
                    nvram.appendChild(username);
                    nvram.appendChild(password);
                    lightboxBody.appendChild(nvram);

                    notify_checkbox.onchange = function () {
                        if(this.checked == true){
                            notify.value = 1;
                            //typeEmailHandler();
                        }else{
                            notify.value = 0;
                        }
                    };

                    ajaxReceive("nvram?email=1", function(data)
                    {
                        //console.log(data);
                        if(Object.keys(data).length > 0) {
                            if(data["nvram12"] == "1") {
                                notify.value = 1;
                                notify_checkbox.checked = true;
                            }else{
                                notify.value = 0;
                                notify_checkbox.checked = false;
                            }
                            email.value = data["nvram13"];
                            smtp.value = data["nvram14"];
                            username.value = data["nvram15"];
                        }
                    });

                    const typeEmailHandler = function(e) {
                        //console.log(e.target.value);

                        clearTimeout(formTimer);
                        formTimer = setTimeout(function()
                        {
                            if(email.value.length < 1 || email.value.includes("@", 1) == false) {
                                alert("Email address invalid");
                                return;
                            }else if(smtp.value.length < 1 || smtp.value.includes(".", 1) == false) {
                                alert("SMTP address invalid");
                                return;
                            }else if(password.value.length < 1) {
                                alert("Password invalid");
                                return;
                            }
                            //Avoid POST sending checkbox values (javascript anomaly sends only 'on' state)
                            notify_checkbox.checked = false;
                            nvram.submit();
                        }, 3800);
                    };

                    password.addEventListener("input", typeEmailHandler);
                }

                if(this.href.indexOf("()") != -1) {
                    eval(this.href);
                }else{
                    window.location = this.href;
                }
            };

            td.appendChild(span);
            tr.appendChild(td);
        }
        menu.appendChild(tr);

    }, function(xhr) { console.error(xhr); });
};

function buildAlerts(view)
{
    //console.log("alert icon height = " + adjustHeight + " | average view height = " + dashboardHeight);

    if(json.alerts.length == 0)
        return;

    var alerts = document.getElementById(view + "Alerts");
    alerts.innerHTML = "";

    if(view === "front")
    {
        var td = buildAlertList(false, adjustHeight - 20);
        td.colSpan = json.analog.length;

        //fixes flip rotation for svg
        for (var i = 0, l = td.childNodes.length; i < l; i++)
            td.childNodes[i].style="";

    }else if (view === "back") {

        var td = buildAlertList(true, adjustHeight /2);
        td.style.height = adjustHeight*2 + "px";
    }

    alerts.appendChild(td);
};

JSON.sort = function(js) {

    var sortable = [];
    for (var i in js) {
        sortable.push([js[i].index, js[i]]);
    }

    sortable.sort(function(a, b){
        return a[0] - b[0];
    });

    var objSorted = [];
    sortable.forEach(function(item){
        objSorted.push(item[1]);
    });

    return objSorted;
};

function buildView(view)
{
	dashboardHidden = [];
    dashboardAnalog = [];
    dashboardDigital = [];
    
    json.analog = JSON.sort(json.analog);
    json.digital = JSON.sort(json.digital);

    for (var i = 0; i < json.analog.length; i++) {
    	console.log(i);
        if(json.analog[i].enabled === true) {
            dashboardAnalog.push(json.analog[i]);
        }else{
            dashboardHidden.push(json.analog[i]);
        }
    }
    for (var i = 0; i < json.digital.length; i++) {
        if(json.digital[i].enabled === true) {
            dashboardDigital.push(json.digital[i]);
        }else{
            dashboardHidden.push(json.digital[i]);
        }
    }

    var table = document.createElement("table");
    var side = document.getElementsByClassName(view);
    side[0].innerHTML = ""; //empty view
    
    if(view === "front")
    {
        if(dashboardAnalog.length > 0) {

        	var table = document.createElement("table");
        	var tr = document.createElement("tr");
            table.appendChild(tr);

            for (var i = 0; i < dashboardAnalog.length; i++)
            {
                if(i == 4 || i == 8) {
                	side[0].appendChild(table);
                	var table = document.createElement("table");
    				var tr = document.createElement("tr");
        			table.appendChild(tr);
                }

                var td = document.createElement("td");
                td.id = "canvasAnalogIndex" + dashboardAnalog[i].index;
                tr.appendChild(td);
            }
            side[0].appendChild(table);
        }

        if(dashboardDigital.length > 0) {

            var table = document.createElement("table");
            var tr = document.createElement("tr");
            table.appendChild(tr);

            for (var i = 0; i < dashboardDigital.length; i++)
            {
                //var td = document.getElementById("canvasDigitalIndex" + i);
                //if (!(td instanceof HTMLCanvasElement)) {
                    var td = document.createElement("td");
                    td.id = "canvasDigitalIndex" + dashboardDigital[i].index;
                    tr.appendChild(td);
                //}
            }
            side[0].appendChild(table);
        }

        side[0].onclick = function () {

            _alert.style.display = "none";

            if(streamHttpRequest != undefined)
                streamHttpRequest.abort();
            clearTimeout(streamAnalogTimer);

            buildView("back");
            renderView("back");

            this.parentElement.style.cssText = "transform:rotateX(180deg); -webkit-transform:rotateX(180deg);";
            for (var i = 0, l = blinkAlert.length; i < l; i++)
                clearInterval(blinkAlert[i]);
            blinkAlert = [];
        };

    }else if (view === "back") {
        
        side[0].style.background = document.body.style.backgroundColor;

        var backMenu = document.createElement("table");
        backMenu.id = "backMenu";
        side[0].appendChild(backMenu);

        var backAvailable = document.createElement("div");
        backAvailable.id = "backAvailable";
        var span = document.createElement("span");
        span.append("Drag & Drop");
        backAvailable.appendChild(span);
        tr = document.createElement("tr");
        td = document.createElement("td");
        td.setAttribute("valign", "top");
        td.appendChild(backAvailable);
        tr.appendChild(td);
        table.appendChild(tr);

        if(dashboardAnalog.length > 0) {
            var divB = document.createElement("div");
            divB.id = "backAnalogSelected";
            tr = document.createElement("tr");
            td = document.createElement("td");
            td.setAttribute("valign", "top");
            td.appendChild(divB);
            tr.appendChild(td);
            table.appendChild(tr);
        }

        if(dashboardDigital.length > 0) {
            var divC = document.createElement("div");
            divC.id = "backDigitalSelected";
            tr = document.createElement("tr");
            td = document.createElement("td");
            //td.setAttribute("valign", "top");
            //divC.height = adjustHeight *2 + "px";
            td.appendChild(divC);
            tr.appendChild(td);
            table.appendChild(tr);
        }

        side[0].appendChild(table);

        side[0].onclick = function () {
            //console.log(this);
            _alert.style.display = "none";

            buildView("front");
            renderView("front");

            setTimeout(function() {
                side[0].innerHTML = ""; //empty view
                animateView();
                saveView();
                setTimeout(function() {
                    streamView(serialStream);
                }, 4000);
            }, 1000);
            this.parentElement.style.cssText = "";
        };
    }

    if(json.alerts.length > 0)
    {
        var table = document.createElement("table");
        var tr = document.createElement("tr");
        tr.id = view + "Alerts";
        table.appendChild(tr);
    }

    side[0].appendChild(table);
};

function renderViewBuild(g)
{
	//var front = document.getElementsByClassName("front");

	for (var i = 0, l = g.length; i < l; i++)
    {
        var t = "Analog";
        if(g[i].pattern != undefined) {
            t = "Digital";
        }

        //var render = document.getElementById(g[i].renderTo);
        var td = document.getElementById("canvas" + t + "Index" + g[i].index);

        if(g[i].enabled)
        {
            //console.log(gauge[i].renderTo);
            serialStream += "," + g[i].serial;

            if(g[i].canbus != "") {
                if(g[i].opendbc != "") {
                    ajaxReceive("opendbc/" + g[i].opendbc, function(data)
                    {
                        var split = data.split("\n");
                        for (i = 0; i < split.length; i++) {
                            //console.log(split[i]);
                            if(split[i].indexOf(g[i].canbus) != -1) {

                                //Find CANId by looping back
                                for (id = i; id >0; id--) {
                                    if(split[id].indexOf("BO_") != -1) {
                                        var v = split[id].split(" ");
                                        console.log("CANId:" + v[1]);
                                        break;
                                    }
                                }
                                //Find CANBit
                                var s = split[i].split(":");
                                var v = s[1].split(" ");
                                console.log("CANBit:" + v[1]);

                                CANBusRead.push(g[i].canbus);
                                return;
                            }
                        }
                        CANBusRead.push(g[i].canbus);
                    });
                }else{
                    CANBusRead.push(g[i].canbus);
                }
            }
            //console.log(JSON.stringify(g[i],null, 2));

            var canvas = document.createElement("canvas");
            canvas.id = g[i].renderTo;
            td.appendChild(canvas);

            if(g[i].pattern != undefined) {
                var sd = new SegmentDisplay(g[i].renderTo);
                sd.pattern = g[i].pattern;
                sd.colorOn = g[i].colorOn;
                sd.colorOff = g[i].colorOff;
                sd.draw();
                sd.setValue(g[i].count);
        	}else{
				new RadialGauge(g[i]).draw();
        	}
        }
    }
};

function renderView(view)
{
    //console.log(json);

    if(view === "front")
    {
        if(json.stream === "read") {
            serialStream = "stream=din_ocur"; //sends TX command then reads RX stream
        }else if(json.stream === "get") {
            serialStream = "get=din_ocur"; //sends TX command then reads RX once
        }else{
            serialStream = "read=1"; //reads incoming serial RX
        }

        renderViewBuild(json.analog);
        renderViewBuild(json.digital);

        /*
        for (i in json.sounds)
        {
            if(json.sounds[i].play)
            {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", "sounds/" + json.sounds[i].id, true);
                xhr.responseType = "arraybuffer";
                xhr.onload = function(e){
                    window.addEventListener("keydown", createPitchStep(json.sounds[i].pitchStep))
                    window.addEventListener("keyup", createPitchStep(-json.sounds[i].pitchStep))
                    engineStart(this.response);
                };
                xhr.send();
                break;
            }
        }
        */
        
    }else if (view === "back") {

        buildMenu();

        var divA = document.getElementById("backAvailable");
        var divB = document.getElementById("backAnalogSelected");
        var divC = document.getElementById("backDigitalSelected");

        divA.appendChild(buildGaugeList(dashboardHidden,"tile_Available"));
        
        new Sortable(document.getElementById('tile_Available'), {
            group: {
                name: 'shared',
                //pull: 'clone'
            },
            animation: 150,
            sort: false,
            /*
            onChoose: function (evt) {
                evt.item.setAttribute('width', "16%");
            },
            */
            onAdd: function (event) {
                event.item.width = divA.parentElement.clientHeight;
                sortView(this, false);
            }
        });

        if(divB != undefined) {
            divB.appendChild(buildGaugeList(dashboardAnalog,"tile_AnalogSelected"));

            new Sortable(document.getElementById('tile_AnalogSelected'), {
                group: {
                    name: 'shared',
                    //pull: 'clone'
                },
                animation: 150,
                sort: true,
                /*
                onChoose: function (evt) {
                    evt.item.setAttribute('width', "24%");
                },
                */
                onAdd: function (event) {
                    event.item.width = dynamicGaugeWidth(dashboardAnalog) * 0.8;
                    sortView(this, true);
                },
                onSort: function (event) {
                    
                    sortView(this, true);
                }
            });
        }
        if(divC != undefined) {
            divC.appendChild(buildGaugeList(dashboardDigital,"tile_DigitalSelected"));

            new Sortable(document.getElementById('tile_DigitalSelected'), {
                group: {
                    name: 'shared',
                    //pull: 'clone'
                },
                animation: 150,
                sort: true,
                onAdd: function (event) {
                    event.item.width = divC.parentElement.clientHeight;
                    sortView(this, true);
                },
                onSort: function (event) {
                    
                    sortView(this, true);
                }
            });
        }
    }

    sizeView(view);
    
    buildAlerts(view);
};

function sortView(list, enabled)
{
    var el = list.el;

    //console.log(el);

    for (var e = 0; e < el.children.length; e++)
    {
        for (a in json.analog)
        {
            if ("_" + json.analog[a].renderTo === el.children[e].id)
            {
            	//console.log(el.children[e].id + ":" + e);

                json.analog[a].index = e;
                json.analog[a].enabled = enabled;
                break;
            }
        }
        for (d in json.digital)
        {
            if ("_" + json.digital[d].renderTo === el.children[e].id)
            {
                //console.log(el.children[e].id + ":" + e);
                
                json.digital[d].index = e;
                json.digital[d].enabled = enabled;
                break;
            }
        }
        /*
        for (var i = 0, l = document.gauges.length; i < l; i++)
        {
            var g = document.gauges[i];
            if ("_" + g.options.renderTo == el.children[e].id) {
                g.options.index = e + offset;
                g.options.enabled = enabled;
                break;
            }
        }
        */
    }
    //console.log(event.item.id);
    //console.log(event.newIndex);
};

function buildAlertList(showAll,size)
{
    var td = document.createElement("td");

    for (var key in json.alerts)
    {
        //console.log(json.alerts[i].svg);
        if(json.alerts[key].enabled == true || showAll) {
            
            if(showAll === false)
                switch (key) {
                    case "emergency":
                    stream += ",din_emcystop";
                    break;
                }

            var span = document.createElement("span");
            var svg = document.createElement("img");
            var x = size / 2;

            if(showAll)
                x = size / 3;

            svg.dataset.color = json.alerts[key].color;
            svg.classList.add("iconic");
            svg.classList.add("svg-grey");
            svg.style.width = size + "px";
            svg.style.height = size + "px";
            svg.src = "svg/" + json.alerts[key].icon + ".svg";
            //svg.setAttribute("data-src", "svg/" + key + ".svg");
            span.style.position = "relative";
            span.style.zIndex = "1";
            span.id = "alert_" + key;
            span.appendChild(svg);
            iconic.inject(svg);

            span.onclick = function (e) {
                //console.log(this);
                //console.log(this.children[1].src);
                e.preventDefault();
                e.stopPropagation();

                if(this.children[1].src.indexOf("disabled") !== -1)
                {
                    json.alerts[this.id.substr(6)].enabled = true;

                    this.children[1].src = "svg/enabled.svg";
                    /*
                    var lightboxBody = document.getElementById("lightboxBody");
                    var lightboxTitle = document.getElementById("lightboxTitle");
                   
                    lightboxBody.innerHTML = "";
                    lightboxTitle.innerHTML = "";

                    if(this.id =="alert_odometer")
                    {
                        var textarea = document.createElement("textarea");
                        textarea.rows = "20";
                        textarea.value = JSON.stringify(json.odometer, null, 2);
                        lightboxBody.appendChild(textarea);
                        window.location = "#openModal";
                    }
                    */
                }else{
                    json.alerts[this.id.substr(6)].enabled = false;
                    this.children[1].src = "svg/disabled.svg";
                }

                console.log("...set alert '" + this.id.substr(6) + "' " + json.alerts[this.id.substr(6)].enabled);

                //buildAlerts("front");
            };

            if(showAll)
            {
                var overlay = document.createElement("img");
                overlay.classList.add("iconic");
                if(json.alerts[key].enabled)
                {
                    overlay.src = "svg/enabled.svg";
                }else{
                    overlay.src = "svg/disabled.svg";
                }
                overlay.style.cssText = "position:relative;top:" + x + "px;left:-" + x + "px;width:" + x + "px;height:" + x + "px;";
                span.appendChild(overlay);
                //iconic.inject(overlay);
            }

            td.appendChild(span);
        }
    }

    return td;
};

function buildGaugeList(g,id,title)
{
	console.log(g);

    var tile = document.createElement("div");
    tile.classList.add("tile");
    //tile.dataset.force = array.length;
    var tile_list = document.createElement("div");
    tile_list.classList.add("tile_list");
    tile_list.id = id;

    if(title != undefined)
    {
        var tile_name = document.createElement("div");
        tile_name.classList.add("tile_name");
        tile_name.textContent = title;
        //tile_name.style.display = "none";
        tile.appendChild(tile_name);
    }
    
    var back = document.getElementsByClassName("back");
    
    //TODO: sort by index before generating img
    for (var i = 0; i < g.length; i++)
    {
        var e = g[i].enabled;

        g[i].enabled = false; //does not put these into active gauge list
        g[i].renderTo = "_" + g[i].renderTo; //set temporary id

        var canvas = document.createElement("canvas");
        canvas.id = g[i].renderTo;

        back[0].appendChild(canvas);
        
        if(g[i].pattern != undefined) {
        	var sd = new SegmentDisplay(g[i].renderTo);
            sd.pattern = g[i].pattern;
            sd.colorOn = g[i].colorOn;
            sd.colorOff = g[i].colorOff;
            sd.draw();
            sd.setValue(g[i].count);
            //updateOdometer(parseFloat(json.odometer.count));
        }else{
            new RadialGauge(g[i]).draw();
        }
        canvas.remove();

        var ctx = canvas.getContext('2d');
        var img = document.createElement("img");
        img.src = canvas.toDataURL();
        img.id = g[i].renderTo;
        img.code = g[i];
        //img.width = "40px";
        tile_list.appendChild(img);

        img.onclick = function (e) {

            e.preventDefault();
            e.stopPropagation();

            var lightboxBody = document.getElementById("lightboxBody");
            lightboxBody.innerHTML = ""; //empty

            var code = document.createElement("textarea");
            code.rows = "20";
            code.id = "code" + this.id;
            code.value = JSON.stringify(this.code, null, 2);

            lightboxBody.appendChild(code);

            window.location = "#openModal";

            code.onchange = function (e) {

                //console.log(this.value);

                for (i in json.analog)
                {
                    if("code_" + json.analog[i].renderTo === this.id)
                    {
                        json.analog[i] = JSON.parse(this.value);
                        break;
                    }
                }
                for (i in json.digital)
                {
                    if("code_" + json.digital[i].renderTo === this.id)
                    {
                        json.digital[i] = JSON.parse(this.value);
                        break;
                    }
                }
                //renderView("front");
            };
        };

        //set options back
        g[i].enabled = e;
        g[i].renderTo = g[i].renderTo.substr(1);
    }

    tile.appendChild(tile_list);

    return tile;
};

function streamInit(serial,canbus)
{
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {

            var error = "";

            if (xhr.status === 200) {

                console.log(xhr.responseText);
                error = xhr.responseText;

                if(error.indexOf("Serial") != -1 || error.indexOf("CAN") != -1) {
                    streamView(serialStream);
                    return;
                }
            } else {
                console.log(xhr.statusText);
                error = xhr.statusText;
            }
            _alert.innerHTML = "Cannot Initialize Serial or CAN " + error;
            _alert.style.display = "block";
        }
    }

    xhr.timeout = 6000;
    xhr.open("GET", "serial.php?init=1&serial=" + serial + "&canbus=" + canbus, true);
    xhr.send();
};

function streamReset(pid)
{
    ajaxSend("serial.php?reset=1&pid=" + pid);
};

function ajaxSend(url)
{
    console.log(url);

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                console.log(xhr.responseText);
            } else {
                console.log(xhr.statusText); 
            }
        }
    }

    xhr.timeout = 1000;
    xhr.open("GET", url, true);
    xhr.send();
};

function getGaugeID(id)
{
    for (var i = 0, l = document.gauges.length; i < l; i++) {
        var g = document.gauges[i];
        if (g.options.renderTo == id) {
            return i;
        }
    }
};

function setColorAlert(id, color)
{
    var span = document.getElementById("alert_" + id);
    var svg = span.childNodes[0];

    svg.classList.remove("svg-grey");
    svg.classList.remove("svg-orange");
    svg.classList.remove("svg-green");
    svg.classList.add("svg-" + color);
};

function setBlinkAlert(i, id)
{
    //clearInterval(blinkAlert[i]);

    blinkAlert[i] = setInterval(function()
    {
        var span = document.getElementById("alert_" + id);
        var svg = span.childNodes[0];

        //console.log(svg.className + ":" + svg.dataset.color);
        
        if(svg.className.baseVal.indexOf(svg.dataset.color) !== -1) {
            svg.classList.remove(svg.dataset.color);
            svg.classList.add("svg-grey");
        }else{
            svg.classList.remove("svg-grey");
            svg.classList.add(svg.dataset.color);
        }

        //new SVGInjector().inject(svg);
        //SVGInjector(svg);

    }, 1000);
};

function streamView(stream)
{
    //TODO: Detect idle mode and slow down stream

    clearTimeout(streamAnalogTimer);

    console.log("serial.php?" + stream);

    if(stream.length == 0)
        return;

    streamHttpRequest = new XMLHttpRequest();
    streamHttpRequest.items = stream.split(",");
    streamHttpRequest.i = 0;
    streamHttpRequest.last = (streamHttpRequest.items.length - 1);
    streamHttpRequest.gaugeid = [stream.length];
    streamHttpRequest.delay = 640;
    streamHttpRequest.timeoutCount = 0;

    for (var i = 0; i < stream.length; i++)
    {
        streamHttpRequest.gaugeid[i] = getGaugeID(streamHttpRequest.items[i]);
        //console.log("gauge is search for " + streamHttpRequest.items[i] + " = " + streamHttpRequest.gaugeid[i]);
    }

	streamHttpRequest.onreadystatechange = function()
	{
        //console.log("State change: "+ streamHttpRequest.readyState);

        if(streamHttpRequest.readyState == 3) {

            var newData = streamHttpRequest.response.substr(streamHttpRequest.seenBytes);
            //console.log(newData + "\n-------------");

            if (newData.indexOf("Error") != -1) {

                if (newData.indexOf("<?php") != -1) {
                    _alert.innerHTML = "PHP Not Found";
                }else{
                    _alert.innerHTML = newData;
                }
                _alert.style.display = "block";

                streamHttpRequest.abort();

            } else {

                var data = newData.slice(0, -1).split("\n");

                //console.log(data);
                //console.log(this.items);

                for (var d = 0; d < data.length; d++)
                {
                    //console.log("[" + this.i + ":" + data.length + "] " + this.items[this.i] + ":" + data[d]);

                    if(this.items[this.i] === "udc")
                    {
                        //console.log(data[d] + ":" + data[d+1]);
                        var percent = parseInt(data[d]) / parseInt(data[d+1]) * 100;

                        if(percent > 0)
                        {
                            if(json.alerts.battery.show)
                            {
                                if(percent < 20) {
                                
                                    if(blinkAlert[0] === undefined)
                                    {
                                        console.log("battery: " + data[d]);
                                        setBlinkAlert(0, "battery");
                                    }
                                }else if(percent > 80) {
                                    setColorAlert("battery", "green");
                                }else if(percent > 20 && percent < 80) {
                                    setColorAlert("battery", "orange");
                                }else{
                                    clearInterval(blinkAlert[0]);
                                    setColorAlert("battery", "grey");
                                }
                            }
                            //console.log("battery: " + percent + "%");
                            document.gauges[this.gaugeid[this.i]].value = percent;
                        }

                    }else if(this.items[this.i] === "speed") {

                        document.gauges[this.gaugeid[this.i]].value = data[d];

                    }else if(this.items[this.i] === "din_emcystop" && json.alerts.emergency.show) {
                        
                        if(data[d] === "1.00") {
                            if(blinkAlert[1] === undefined)
                            {
                                console.log("emergency: " + data[d]);
                                setBlinkAlert(1, "emergency");
                            }
                        }else{
                            clearInterval(blinkAlert[1]);
                        }
                    }
                    
                    if (this.i == this.last)
                        this.i = 0;
                    else
                        this.i++;
                }
               
                /*
                var svg = document.getElementById("battery");
                svg.classList.add(svg.dataset.color);
                new SVGInjector().inject(svg);
                */
			}
			streamHttpRequest.seenBytes = streamHttpRequest.responseText.length;

            //console.log("seenBytes: " + streamHttpRequest.seenBytes);

		} else if (streamHttpRequest.readyState == 4) {

            //console.log("Complete");

            if (streamHttpRequest.status === 200) {

                //console.log(streamHttpRequest.responseText);
                
                streamAnalogTimer = setTimeout(function() {
                    streamView(serialStream);
                }, streamHttpRequest.delay);
                
            } else {

                console.log(streamHttpRequest.status);

                //if (streamHttpRequest.seenBytes) {
                //    _alert.innerHTML = "Connection Lost";
                //    _alert.style.display = "block";
                //}
            }
		}
	};

    streamHttpRequest.ontimeout = function () {
        //console.log("Reset PID: " + pid);
        //streamReset(pid);

        console.log("Timed Out");

        if(this.timeoutCount > 5)
        {
            this.timeoutCount = 0;

            _alert.innerHTML = "Connection Lost";
            _alert.style.display = "block";

        }else{
            streamAnalogTimer = setTimeout(function() {
                streamView(serialStream);
            }, streamHttpRequest.delay);

            this.timeoutCount++;
        }
    };

    streamHttpRequest.timeout = 10000;
    streamHttpRequest.open('GET', "serial.php?" + stream + "&loop=4&delay=" + streamHttpRequest.delay, true);
    streamHttpRequest.send();
};

function ajaxReceive(path, success, error)
{
    var xhr = new XMLHttpRequest();
    xhr.open("GET", path, true);
    //xhr.setRequestHeader('Content-Type', 'application/json'); 
    xhr.send();

    xhr.onreadystatechange = function()
    {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                if (success)
					if(Object.keys(xhr.responseText).length > 0) {
						success(JSON.parse(xhr.responseText));
					}else{
						success(xhr.responseText);
					}
            } else {
                if (error)
                    error(xhr);
            }
        }
    };
};

function snapshotExport()
{
    var d = new Date();
    var data = encode(JSON.stringify(json,null,2));
    var blob = new Blob([data], { type: 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "dashboard " + d.getDate() + "-" + (d.getMonth() + 1) + "-" + d.getFullYear() + " " + (d.getHours() % 12 || 12) + "-" + d.getMinutes() + " " + (d.getHours() >= 12 ? 'pm' : 'am') + ".json";
    document.body.appendChild(a); // Required for FF
    a.click();
    setTimeout(function () {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);
};

function snapshotImport()
{
    document.getElementsByClassName("snapshotUpload")[0].click();
};

var encode = function( s ) {
    var out = [];
    for ( var i = 0; i < s.length; i++ ) {
        out[i] = s.charCodeAt(i);
    }
    return new Uint8Array( out );
};

function saveView()
{
    console.log("saving view");

    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'views/save.php', true);
    xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xhr.onload = function () {
        //console.log(this.responseText);
        if(this.responseText !== "")
        {
            _alert.innerHTML = this.responseText;
            _alert.style.display = "block";
        }
    };
    xhr.send('view=' + view + '&json=' + encodeURI(JSON.stringify(json)));
};

function getWidth() {
  return Math.max(
    //document.body.scrollWidth,
    //document.documentElement.scrollWidth,
    //document.body.offsetWidth,
    //document.documentElement.offsetWidth,
    document.documentElement.clientWidth
  );
};

function getHeight() {
  return Math.max(
    //document.body.scrollHeight,
    //document.documentElement.scrollHeight,
    //document.body.offsetHeight,
    //document.documentElement.offsetHeight,
    document.documentElement.clientHeight
  );
};

function updateOdometer(n) {
    n += 0.01
    odometer.setValue(n.toString());
    streamDigitalTimer = setTimeout(function(){
        updateOdometer(n);
    }, 200);
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  var R = 6371; // km
  var dLat = (lat2 - lat1).toRad();
  var dLon = (lon2 - lon1).toRad();
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1.toRad()) * Math.cos(lat2.toRad()) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  var d = R * c;
  return d;
};

Number.prototype.toRad = function() {
  return this * Math.PI / 180;
};

/*
function IOSDisableHandle() {
    var listToDisable = document.querySelectorAll('.handleGroupDrag'); //needed for IOS devices on Safari browser (FIX)
    if (listToDisable) {
        listToDisable.forEach(item => {
            item.addEventListener('touchstart', (event) => {
                event.preventDefault();
            })
        })
    }
}
*/

function setCookie(name, value, exdays) {

    var exdate = new Date();
    exdate.setDate(exdate.getDate() + exdays);
    var c_value = escape(value) + (exdays == null ? "" : "; expires=" + exdate.toUTCString());
    document.cookie = name + "=" + c_value;
};

function getCookie(name) {
    
    var i,
        x,
        y,
        ARRcookies = document.cookie.split(";");

    for (var i = 0; i < ARRcookies.length; i++) {
        x = ARRcookies[i].substr(0, ARRcookies[i].indexOf("="));
        y = ARRcookies[i].substr(ARRcookies[i].indexOf("=") + 1);
        x = x.replace(/^\s+|\s+$/g, "");
        if (x == name) {
            return unescape(y);
        }
    }
};