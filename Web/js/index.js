var view = getCookie("view");
var json = "";

var blinkAlert = [];

var odometer;

var dashboardHidden = [];
var dashboardAnalog = [];
var dashboardDigital = [];
var adjustHeight;

var stream = "";
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

    loadJSON("views/" + view, function(data)
    {
        //console.log(data);
        json = data;

        document.body.style.backgroundImage = "url('views/bg/" + data.background + "')"; 

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

function sizeView(view)
{
    if(view === "front")
    {
        var w = Math.round(getWidth() / dashboardAnalog.length);
        var h = 100; //Math.round(getHeight() - (w*2)); //TODO: calculate dynamically

        adjustHeight = h;
        
        //alert(getHeight() + " " + w + ":" + h);

        if(dashboardDigital.length > 0)
            h *=2;

        for (var i = 0, l = document.gauges.length; i < l; i++) {

            var gauge = document.gauges[i];
            //console.log(gauge);

            if (gauge.options.enabled == true) {

                //console.log("... adjust size " + gauge.options.renderTo);

                gauge.options.width = w;
                gauge.options.height = getHeight() - h;
                gauge.update();

                var td = document.getElementById(gauge.options.renderTo);
                td.parentElement.width = gauge.options.width;
                td.parentElement.height = gauge.options.height;
            //}else {
            }
        }

        /*
        var maxH = [];
        for (var i = 0; i < json.analog.length; i++)
        {
            var t = document.getElementById("canvasIndex" + i);
            console.log("canvasIndex" + i + " height=" + t.height);
            maxH.push(t.height);
        }
        dashboardHeight = Math.max.apply(null,maxH);
        */

    }else if (view === "back") {

        var divM = document.getElementById("backMenu");
        var divA = document.getElementById("backAvailable");
        var divB = document.getElementById("backAnalogSelected");
        var divC = document.getElementById("backDigitalSelected");

        divA.parentElement.height = Math.round(getHeight() / 5);
        divC.parentElement.height = Math.round(getHeight() / 6);
        divB.parentElement.height = getHeight() - divM.parentElement.height - divA.parentElement.height - divC.parentElement.height - adjustHeight*2;

        for (var i = 0; i < json.analog.length; i++)
        {
            var img = document.getElementById("_" + json.analog[i].renderTo);
            img.width = img.parentElement.parentElement.parentElement.parentElement.height;
        }
    }
};

function buildOdometer(view)
{
    //var odometer = CANRead("distance");

    clearTimeout(streamDigitalTimer);
    
    var tr = document.getElementById(view + "Odometer");
    tr.innerHTML = "";

    console.log("... build odometer " + json.alerts.odometer.enabled);

    if(json.alerts.odometer.enabled === true)
    {
        var td = document.createElement("td");
        td.colSpan = json.analog.length;

        var canvasOdometer = document.createElement("canvas");
        canvasOdometer.id = "odometer";
        //canvasOdometer.style="position:relative; top:-" + (getHeight() - dashboardHeight) + "px;";
        canvasOdometer.height = adjustHeight-10;

        td.appendChild(canvasOdometer);
        tr.appendChild(td);

        odometer = new SegmentDisplay("odometer");
        odometer.pattern = json.odometer.pattern;
        odometer.colorOn = json.odometer.colorOn;
        odometer.colorOff = json.odometer.colorOff;
        odometer.draw();
        odometer.setValue(json.odometer.count);
        //updateOdometer(parseFloat(json.odometer.count));
    }
};

function buildMenu(view)
{
    var menu = document.getElementById(view + "Menu");

    loadJSON("js/menu.json", function(data)
    {
        console.log(data);

        for (var key in data.menu)
        {
            console.log(data.menu[key].icon);

            var span = document.createElement("span");
            var svg = document.createElement("img");

            //svg.dataset.color = "";
            svg.classList.add("iconic");
            svg.classList.add("svg-grey");
            svg.style.width = adjustHeight/2 + "px";
            svg.style.height = adjustHeight/2 + "px";
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
                    var ul = document.createElement("ul");
                    ul.classList.add("slides");

                    //TODO: loop through all background
                    loadJSON("views/bg/index.json", function(data)
                    {
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

                            img.src = "views/bg/" + data.index[u].file;
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
                                json.background = this.src;
                                document.body.style.backgroundImage = "url('views/bg/" + this.src + "')";
                                window.location = "#close";
                            };
                        }
                        ul.appendChild(nav_dots);
                    });

                    lightboxBody.appendChild(ul);
                }
                else if(this.id =="menu_view")
                {
                    var center = document.createElement("center");
                    var select = document.createElement("select");

                    loadJSON("views/index.json", function(data) {
                        for (var key in data.index) {
                            var opt = document.createElement('option');
                            opt.value = data.index[key].file;
                            opt.append(data.index[key].name);
                            select.appendChild(opt);
                        }
                    });

                    center.appendChild(select);
                    lightboxBody.appendChild(center);

                    select.onchange = function () {
                        //console.log(this.value);
                        window.location = "#close";
                        setCookie("view", this.value, 360);
                        location.reload();
                    };
                }
                else if(this.id =="menu_rfid")
                {
                    var textarea = document.createElement("textarea");
                    textarea.rows = "20";
                    textarea.placeholder = "Unlock Codes (MIFARE Protocol 13.56 Mhz)";
                    lightboxBody.appendChild(textarea);
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

                    loadJSON("nvram", function(data)
                    {
                        console.log(data);

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
                                nvram.submit();
                            }
                        }, 2000);
                    }

                    passwordC.addEventListener("input", typeWiFiHandler);
                }
                else if(this.id =="menu_network")
                {
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
                            ip.disabled = true;
                            subnet.disabled = true;
                            gateway.disabled = true;
                            dns.disabled = true;
                            typeNetworkHandler();
                        }else{
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
                            nvram.submit();
                        }, 3200);
                    }

                    //ip.addEventListener("input", typeNetworkHandler);
                    //subnet.addEventListener("input", typeNetworkHandler);
                    //gateway.addEventListener("input", typeNetworkHandler);
                    dns.addEventListener("input", typeNetworkHandler);
                }
                else if(this.id =="menu_email")
                {
                    var email = document.createElement("input");
                    var smtp = document.createElement("input");
                    var username = document.createElement("input");
                    var password = document.createElement("input");

                    email.type = "text";
                    smtp.type = "text";
                    username.type = "text";
                    password.type = "password";

                    email.placeholder = "Email";
                    smtp.placeholder = "Email Server (SMTP)";
                    username.placeholder = "Email Username";
                    password.placeholder = "Email Password";

                    email.value = json.notify.email;
                    smtp.value = json.notify.smtp;
                    username.value = json.notify.username;
                    password.value = json.notify.password;

                    lightboxBody.appendChild(email);
                    lightboxBody.appendChild(smtp);
                    lightboxBody.appendChild(username);
                    lightboxBody.appendChild(password);

                    /*
                    save.onclick = function (e) {

                        json.wifi.email = email.value;
                        json.wifi.smtp = smtp.value;
                        json.wifi.username = username.value;
                        json.wifi.password = password.value;

                        window.location = "#close";
                    };
                    */
                }

                window.location = this.href;
            };

            menu.appendChild(span);
        }

    }, function(xhr) { console.error(xhr); });
};

function buildAlerts(view)
{
    //console.log("alert icon height = " + adjustHeight + " | average view height = " + dashboardHeight);

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

function buildView(view)
{
    var side = document.getElementsByClassName(view);
    var table = document.createElement("table");
    var tr = document.createElement("tr");

    table.id = view + "Table";

    if(view === "front")
    {
        for (var i = 0, l = json.analog.length; i < l; i++)
        {
            var td = document.getElementById( "canvasIndex" + i);

            if (!(td instanceof HTMLCanvasElement)) {

                var td = document.createElement("td");
                td.id = "canvasIndex" + i;
                tr.appendChild(td);

                json.analog[i].width = Math.round(getWidth()/3);
                json.analog[i].height = json.analog[i].width;
            }
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

        var divM = document.createElement("div");
        var divA = document.createElement("div");
        var divB = document.createElement("div");
        var divC = document.createElement("div");
        var table = document.createElement("table");

        divM.id = "backMenu";
        divA.id = "backAvailable";
        divB.id = "backAnalogSelected";
        divC.id = "backDigitalSelected";

        var span = document.createElement("span");
        span.append("Drag & Drop");
        divA.append(span);

        var tr = document.createElement("tr");
        var td = document.createElement("td");
        td.setAttribute("valign", "top");
        td.style.height = adjustHeight/2 + "px";
        td.appendChild(divM);
        tr.appendChild(td);
        table.appendChild(tr);

        tr = document.createElement("tr");
        td = document.createElement("td");
        td.setAttribute("valign", "top");
        td.appendChild(divA);
        tr.appendChild(td);
        table.appendChild(tr);

        tr = document.createElement("tr");
        td = document.createElement("td");
        td.setAttribute("valign", "top");
        td.appendChild(divB);
        tr.appendChild(td);
        table.appendChild(tr);

        tr = document.createElement("tr");
        td = document.createElement("td");
        //td.setAttribute("valign", "top");
        //divC.height = adjustHeight *2 + "px";
        td.appendChild(divC);
        tr.appendChild(td);
        table.appendChild(tr);

        side[0].onclick = function () {
            //console.log(this);
            _alert.style.display = "none";

            renderView("front");

            setTimeout(function(){
                side[0].innerHTML = "";
                animateView();
                saveView();
                setTimeout(function() {
                    streamView();
                }, 4000);
            }, 1000);
            this.parentElement.style.cssText = "";
        };
    }

    table.appendChild(tr);
    /*
    var tr = document.createElement("tr");
    tr.id = view + "Odometer";
    table.appendChild(tr);
	*/
    var tr = document.createElement("tr");
    tr.id = view + "Alerts";
    table.appendChild(tr);

    side[0].appendChild(table);
};

function renderView(view)
{
    //console.log(json);

    if(view === "front")
    {
        stream = "din_ocur";
        dashboardAnalog = [];
        dashboardHidden = [];

        var front = document.getElementsByClassName("front");

        for (var i = 0, l = json.analog.length; i < l; i++)
        {
            var render = document.getElementById(json.analog[i].renderTo);
            var td = document.getElementById("canvasIndex" + json.analog[i].index);

            if(json.analog[i].enabled)
            {
                //console.log(json.analog[i].renderTo);

                switch (json.analog[i].renderTo) {
                    case "udc":
                    stream += ",udc,udcmax";
                    break;
                case "speed":
                    stream += ",speed";
                    break;
                case "temp":
                    stream += ",tmpm,tmphs";
                    break;
                }

                if (render instanceof HTMLCanvasElement)
                {
                    //if element exists we want to verify canvasindex is correct
                    //console.log(render.parentElement.id + " > " + json.analog[i].index);

                    if(render.parentElement.id !== "canvasIndex" + json.analog[i].index)
                    {
                        console.log("index incorrect ...moving canvas");

                        render.parentElement.width = 0;
                        render.remove();
                        td.appendChild(render);
                    }

                }else{
                    //console.log(JSON.stringify(json.analog[i],null, 2));

                    var canvas = document.createElement("canvas");
                    canvas.id = json.analog[i].renderTo;
                    td.appendChild(canvas);

                    new RadialGauge(json.analog[i]).draw();
                }

                dashboardAnalog.push(json.analog[i]);

            }else{

                if (render instanceof HTMLCanvasElement) {
                    //console.log("...hide canvas " + json.analog[i].renderTo);
                    render.parentElement.width = 0;
                    render.remove();
                }

                dashboardHidden.push(json.analog[i]);
            }
        }

        //buildOdometer(view);

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

        buildMenu("back");

        var divA = document.getElementById("backAvailable");
        var divB = document.getElementById("backAnalogSelected");
        var divC = document.getElementById("backDigitalSelected");

        divA.appendChild(buildGaugeList(dashboardHidden,"tile_Available"));
        divB.appendChild(buildGaugeList(dashboardAnalog,"tile_AnalogSelected"));
        divC.appendChild(buildGaugeList(dashboardDigital,"tile_DigitalSelected"));

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

                event.item.width = divA.parentElement.height;

                sortView(this, event, false);
                //renderView("front");
            }
        });
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
                //event.from;
                event.item.width = divB.parentElement.height;

                sortView(this, event, true);
                //renderView("front");
            },
            //onUpdate: function (event) {
            onSort: function (event) {
                
                sortView(this, event, true);
                //renderView("front");
            }
        });
        new Sortable(document.getElementById('tile_DigitalSelected'), {
            group: {
                name: 'shared',
                //pull: 'clone'
            },
            animation: 150,
            sort: true,
            onAdd: function (event) {
                //event.from;
                event.item.width = divC.parentElement.height;

                sortView(this, event, true);
            }
        });
    }

    sizeView(view);
    
    buildAlerts(view);
};

function sortView(list, event, enabled)
{
    var el = list.el;

    for (var e = 0; e < el.children.length; e++)
    {
        for (i in json.analog)
        {
            if ("_" + json.analog[i].renderTo === el.children[e].id)
            {
                //console.log(el.children[e].id + ":" + e);
                
                json.analog[i].index = e;
                json.analog[i].enabled = enabled;
                break;
            }
        }

        for (var i = 0, l = document.gauges.length; i < l; i++)
        {
            var gauge = document.gauges[i];
            if ("_" + gauge.options.renderTo == el.children[e].id) {
                gauge.options.index = e;
                gauge.options.enabled = enabled;
                break;
            }
        }
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
        if((json.alerts[key].show == true && json.alerts[key].enabled == true) || showAll) {
            
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
            svg.src = "svg/" + key + ".svg";
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

                //buildOdometer("front");
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

function buildGaugeList(array,id,title)
{
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
    
    for (var i = 0; i < array.length; i++) {

        var e = array[i].enabled;

        array[i].enabled = false; //does not put these into active gauge list
        array[i].renderTo = "_" + array[i].renderTo; //set temporary id

        var canvas = document.createElement("canvas");
        canvas.id = array[i].renderTo;

        back[0].appendChild(canvas);
        var gauge = new RadialGauge(array[i]).draw();
        canvas.remove();

        var ctx = canvas.getContext('2d');
        var img = document.createElement("img");
        img.src = canvas.toDataURL();
        img.id = array[i].renderTo;
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

            for (i in json.analog)
            {
                if("_" + json.analog[i].renderTo === this.id)
                {
                    code.value = JSON.stringify(json.analog[i], null, 2);
                    break;
                }
            }
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
                //renderView("front");
            };
        };

        //set options back
        array[i].enabled = e;
        array[i].renderTo = array[i].renderTo.substr(1);
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
                    streamView();
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
        var gauge = document.gauges[i];
        if (gauge.options.renderTo == id) {
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

function streamView()
{
    //TODO: Detect idle mode and slow down stream

    clearTimeout(streamAnalogTimer);

    console.log("serial.php?stream=" + stream);

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
                    streamView();
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
                streamView();
            }, streamHttpRequest.delay);

            this.timeoutCount++;
        }
    };

    streamHttpRequest.timeout = 10000;
    streamHttpRequest.open('GET', "serial.php?stream=" + stream + "&loop=4&delay=" + streamHttpRequest.delay, true);
    streamHttpRequest.send();
};

function loadJSON(path, success, error)
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