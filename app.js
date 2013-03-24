var fm_key, fm_url, fm_user;

var groups       = {};
var feeds        = {};
var feeds_groups = {};
var favicons     = {};

var items              = [];
var saved_items        = [];
var session_read_items = [];

// For navigation purposes to refresh listviews
var called_group     = false;
var called_saved     = false;
var called_feed      = false;
var called_sparks    = false;
var called_hot       = false;
var called_all_feeds = false;
var called_kindling  = false;

var loading           = 0; // counts current loading processes
var auth_success      = false; // if a successful auth has been registered this is true. helps on stopped or failed connections. Not (!) used for authentification
var last_fmjs_refresh = 0; // unix timestamps in seconds when were items refreshed last time

function start() {
	// Load Config, if any
	getSettings();
	// Check, if we have all the auth-data

	// test-auth
	if ( fm_url == "" ) {
		checkAuth(0);
	}
	
	showHideLoader("start");
	$.post(fm_url + "?api", { api_key: fm_key }).done(function(data) {
		showHideLoader("stop");
		if ( checkAuth(data.auth) ) {
			auth_success = true;
			// Get groups and build them
			compareSavedItems("start");
			showHideLoader("start");
			$.post(fm_url + "?api&groups", { api_key: fm_key }).done(function(data) {
				showHideLoader("stop");
				if ( checkAuth(data.auth) ) {
					
					groups       = _.sortBy(data.groups, "title");
					feeds_groups = data.feeds_groups;
					createGroups(false);
					$.post(fm_url + "?api&feeds", { api_key: fm_key }).done(function(data) {
						if ( checkAuth(data.auth) ) {
							feeds = _.sortBy(data.feeds, "title");
							refreshItems();
						}
					});
				}
			}).fail(function(){ showHideLoader("stop"); checkAuth(0); });

		}
			
	}).fail(function(){ showHideLoader("stop"); checkAuth(0); });
	
}

function refreshItems() {
	console.log("Refreshing items");
	createGroups(true);
	last_fmjs_refresh =  Math.round(+new Date()/1000); // from: http://stackoverflow.com/questions/221294/how-do-you-get-a-timestamp-in-javascript
	showHideLoader("start");
	$.post(fm_url + "?api&unread_item_ids", { api_key: fm_key }).done(function(data) {
		showHideLoader("stop");
		if ( checkAuth(data.auth) ) {
			var ids = data.unread_item_ids.split(',');
			items = [];
			loadItems(ids);
		}
	}).fail(function(){ showHideLoader("stop"); checkAuth(0); });
}

function loadItems(ids) {

	// Fever-API allows to get a maximum of 50 links per request, we need to split it, obviously
	//console.log(placeholder_ids.length);
	if ( ids.length > 20 ) {
		var first = _.first(ids, 20);
		var rest  = _.rest(ids, 20);
	} else {
		var first = ids;
		var rest = [];
	}
	var get_ids = first.join(",");
	showHideLoader("start");
	$.post(fm_url + "?api&items&with_ids="+ _.escape(get_ids), { api_key: fm_key }).done(function(data) {
		showHideLoader("stop");
		if ( checkAuth(data.auth) ) {
			$.each(data.items, function(index, value) {
				// Save each item in cache
				items.push(value);
			});
		}
	});
	
	if ( rest.length > 0 ) {
		loadItems(rest);
	} else {
		// finished
	}
	
}


function createGroups(refresh) {	
	if ( refresh == true ) {
		showHideLoader("start");
		$.post(fm_url + "?api&groups", { api_key: fm_key }).done(function(data) {
			showHideLoader("stop");

			if ( checkAuth(data.auth) ) {
				feeds_groups = data.feeds_groups;
				groups       = _.sortBy(data.groups, "title");
				createGroups(false);
			}
		}).fail(function(){ showHideLoader("stop"); checkAuth(0); });
	} else {
		$("#fmjs-groups").empty();
		$("#fmjs-groups").listview( "refresh" );
		$.each( groups, function(index, value) {
			var item = '<li data-theme="c" id="fmjs-group-'+value.id+'"><a href="#" onclick="showGroup('+value.id+');" data-transition="slide">'+ _.escape(value.title) +'</a></li>';
			$("#fmjs-groups").append(item);
		});
	
		$("#fmjs-groups").listview( "refresh" );
	}
}

function getSettings() {
	if ( $.jStorage.storageAvailable() ) {
		fm_key   = $.jStorage.get("fmjs-key", "");
		fm_url   = $.jStorage.get("fmjs-url", "");
		fm_user  = $.jStorage.get("fmjs-user", "");
		favicons = $.jStorage.get("fmjs-favicons");
		
		saved_items = $.jStorage.get("fmjs-local-items", []);
		
		if ( fm_url != "" ) {
			$("#fmjs-fever-url").val(fm_url);
		}
		if ( fm_user != "" ) {
			$("#fmjs-e-mail").val(fm_user);
		}

	} else {
		return false;
	}
}

function saveSettings() {
	var url, user, password;
	url      = $.trim($("#fmjs-fever-url").val());
	user     = $.trim($("#fmjs-e-mail").val());
	password = $.trim($("#fmjs-password").val());

	if ( $.jStorage.storageAvailable() ) {
		$.jStorage.set("fmjs-url", url);
				
		if ( password != "" ) {
			key = MD5(user + ":" + password);
			$.jStorage.set("fmjs-user", user);
			$.jStorage.set("fmjs-key", key);
		}
		console.log("Saved");
	} else {
		return false;
	}
	start();
	$.mobile.changePage("#page-home", {transition: "slide"});
	
}

function refreshSavedItems() {
	showHideLoader("start");
	$.post(fm_url + "?api&saved_item_ids", { api_key: fm_key }).done(function(data) {
		showHideLoader("stop");
		if ( checkAuth(data.auth) ) {
			$.jStorage.set("fmjs-local-items", []);
			saved_items = [];
			if ( data.saved_item_ids != "") {
				var ids = data.saved_item_ids.split(',');
				console.log("Anzahl saved: " + ids.length);
				processLoadedSaveItems = _.after(ids.length, storeLoadedSavedItems);
				loadSavedItems(ids);
			}
		}
	}).fail(function(){ showHideLoader("stop"); checkAuth(0); });
}

function storeLoadedSavedItems() {
	saved_items = _.sortBy(saved_items, "created_on_time");
	$.jStorage.set("fmjs-local-items", saved_items);
	//console.log(saved_items);
	console.log("Locally saved " + saved_items.length + " items");
}

function loadSavedItems(ids) {
	// Fever-API allows to get a maximum of 50 links per request, we need to split it, obviously
	if ( ids.length > 20 ) {
		var first = _.first(ids, 20);
		var rest  = _.rest(ids, 20);
	} else {
		var first = ids;
		var rest = [];
	}
	var get_ids = first.join(",");
	
	showHideLoader("start");
	$.post(fm_url + "?api&items&with_ids=" + get_ids, { api_key: fm_key }).done(function(data) {
		showHideLoader("stop");
		if ( checkAuth(data.auth) ) {
			$.each(data.items, function(index, value) {
				//var local_items = $.jStorage.get("fmjs-local-items", []);
				saved_items.push(value);
				processLoadedSaveItems();
				//$.jStorage.set("fmjs-local-items", local_items);
			});
		}
	}).fail(function(){ showHideLoader("stop"); checkAuth(0); });
	
	if ( rest.length > 0 ) {
		loadItems(rest);
	} else {
		
	}
	
}

function showSaved() {
	$("#fmjs-saved-content").empty();
	$("#fmjs-saved-content").append('<ul id="fmjs-saved-view" data-role="listview" data-divider-theme="d" data-inset="true" data-filter="true"></ul>');
	//var local_items = $.jStorage.get("fmjs-local-items", []);
	//console.log(local_items);
	if ( saved_items.length > 0 ) {
		//local_items = _.sortBy(local_items, "created_on_time");
		$.each(saved_items, function(index, value) {
			var item = "";
			item += '<li data-theme="c"><p>';
							
			var feedname = _.findWhere(feeds, {id: value.feed_id});
			item += getFavicon(feedname);
					
			item += '<a href="" class="fmjs-hot-links fmjs-item-is-read" onclick="showSingleItem('+_.escape(value.id)+');">' + _.escape(value.title) + '</a>';
			item += ' by <a href="" class="fmjs-hot-links" onclick="showFeed('+_.escape(value.feed_id)+');">'+_.escape(feedname.title)+'</a></p>';
			item += '</li>';
			$("#fmjs-saved-view").append(item);

		});
	}
	if (called_saved == false ) {
		called_saved = true;
	} else {
		$("#fmjs-saved-view").listview();
	}
	
	$.mobile.changePage("#page-saved", {transition: "slide"});
}

function showHot(page) {

	if ( page == 1 ) {
		// First page has been called, so do a complete refresh
		$("#fmjs-hot-content").empty();
		$("#fmjs-hot-more").attr("onclick", "showHot(2);");
	} else {
		// another page has been called, so let's append a new one
		var next_page = page;
		next_page++;
		$("#fmjs-hot-more").attr("onclick", "showHot("+next_page+");");
	}
	
	// Get range and offset
	var range  = $("#fmjs-hot-range :selected").attr("value");
	var offset = $("#fmjs-hot-offset :selected").attr("value");

	showHideLoader("start");
	$.post(fm_url + "?api&links&offset="+offset+"&range="+range+"&page="+page, { api_key: fm_key }).done(function(data) {
		showHideLoader("stop");
		if ( checkAuth(data.auth) ) {
		
			load_ids = '';
			$.each(data.links, function(index, value) {
				var item = '';
				var id_list = '';
				load_ids += value.item_ids + ',';
				item += '<div>';
				item += '<h2>';
				item += _.escape( value.temperature ) + '<span style="color:red">°</span>&nbsp;';
				if (value.is_local == 1 && value.is_item == 1) {
					load_ids += value.item_id + ",";
					item += '<a href="#" class="fmjs-link-'+value.item_id+' fmjs-hot-links" onclick="showSingleItem('+value.item_id+');">'+_.escape(value.title)+'</a>';
				} else {
					item += '<a href="'+value.url+'" class="fmjs-hot-links" target="_blank">'+_.escape(value.title)+'</a>';
				}
				
				item += '</h2>';
			
				if (value.is_local == 1 && value.is_item == 1) {
					// Add local stuff here, like excerpt an feed name.
					
					item +='<p style="max-height:2.5em;overflow:hidden;" class="fmjs-link-'+_.escape(value.item_id)+'-content"></p>';
					item += '<p style="text-align:right;">posted by <span class="fmjs-link-'+_.escape(value.item_id)+'-favicon"></span> <span class="fmjs-link-'+_.escape(value.item_id)+'-feedname fmjs-hot-links">Feed</span></p><p style="text-align:right;"><a href="'+_.escape(value.url)+'" target="_blank" data-role="button" data-theme="b" data-inline="true" data-mini="true" class="fmjs-hot-to-button" data-icon="grid">Open URL</a> <a href="#" onclick="saveItem('+_.escape(value.item_id)+');" target="_blank" data-role="button" data-icon="star" data-theme="b" data-inline="true" data-mini="true" class="fmjs-hot-to-button">Save</a></p>';
				}
			
				// Now we show a list of all those items, linking to this hot item...
				item += '<ul data-role="listview" data-divider-theme="d" data-inset="true" id="fmjs-hot-content-link-'+_.escape(value.id)+'" class="fmjs-hot-linkbox fmjs-to-listview">';

				var links = value.item_ids.split(',');
				for (var i=0, link_id; link_id=links[i]; i++) {
					// item is "some", then "example", then "array"
					// i is the index of item in the array
					link_id = _.escape(link_id);
					item += '<li><p><span class="fmjs-link-'+link_id+'-favicon"></span><a href="#" class="fmjs-link-'+link_id+' fmjs-hot-links fmjs-single-item-link-'+link_id+'" onclick="showSingleItem('+link_id+');"><span class="fmjs-link-'+link_id+'-title fmjs-hot-links fmjs-single-item-link-'+link_id+'">Link: '+link_id+'</span></a> by <span class="fmjs-link-'+link_id+'-feedname fmjs-hot-links">Feed</span></p></li>';
					id_list += link_id + ",";
				}	
				item += '</ul>';
				//
				item += '<div style="text-align:right"><a href="#" data-role="button" onclick="markItemsRead(\''+_.escape(id_list)+'\');" data-theme="b" data-inline="true" data-mini="true" class="fmjs-hot-to-button" data-icon="check">Mark Links as read</a></div>';
				//
				item += '</div>';
				$("#fmjs-hot-content").append(item);

				$(".fmjs-hot-to-button").button();
				
			});	

			var ids_to_get = load_ids.split(',');
			ids_to_get     = _.uniq(ids_to_get);
			
			fillLinkPlaceholder(ids_to_get, 'link' );
			if ( page == 1) {
				if ( called_hot == false ) {
					called_hot = true;
				} else {
					$(".fmjs-to-listview").listview().removeClass("fmjs-to-listview");
				}
				$.mobile.changePage("#page-hot", {transition: "slide"});
			} else {
				$(".fmjs-to-listview").listview().removeClass("fmjs-to-listview");
			}
		}
	}).fail(function(){ showHideLoader("stop"); checkAuth(0); });
}

function fillLinkPlaceholder(placeholder_ids, class_prefix) {
	// Fever-API allows to get a maximum of 50 links per request, we need to split it, obviously

	if ( placeholder_ids.length > 20 ) {
		var first = _.first(placeholder_ids, 20);
		var rest  = _.rest(placeholder_ids, 20);
	} else {
		var first = placeholder_ids;
		var rest = [];
	}
	var get_ids = first.join(",");
	showHideLoader("start");
	$.post(fm_url + "?api&items&with_ids="+ _.escape(get_ids), { api_key: fm_key }).done(function(data) {
		showHideLoader("stop");
		if (checkAuth(data.auth) ) {
			$.each(data.items, function(index, value) {
				$(".fmjs-"+class_prefix+"-"+value.id+"-title").html(_.escape(value.title));

				if ( value.is_read == 0 ) {
					$(".fmjs-"+class_prefix+"-"+value.id+"-title").addClass("fmjs-item-is-unread");
				} else {
					$(".fmjs-"+class_prefix+"-"+value.id+"-title").addClass("fmjs-item-is-read");
				}
				$(".fmjs-"+class_prefix+"-"+value.id+"-content").html(_.escape(value.html));

				var feedname = _.findWhere(feeds, {id: value.feed_id});

				$(".fmjs-"+class_prefix+"-"+value.id+"-feedname").html('<a href="#" onclick="showFeed('+_.escape($.trim(feedname.id))+');">'+_.escape(feedname.title)+'</a>');

				var favicon = getFavicon(feedname);
				$(".fmjs-"+class_prefix+"-"+value.id+"-favicon").append(favicon).removeClass("fmjs-"+class_prefix+"-"+value.id+"-favicon");

			});
		
		}
	}).fail(function(){ showHideLoader("stop"); checkAuth(0); });
	
	if ( rest.length > 0 ) {
		fillLinkPlaceholder(rest, class_prefix);
	}
}

function showGroup(id) {

	$("#fmjs-group-content").removeData("fmjs-current-ids");
	$("#fmjs-group-content").removeData("fmjs-current-group-id");
	$("#fmjs-group-content").empty();
	$("#fmjs-group-content").append('<ul data-role="listview" data-divider-theme="d" data-inset="true" data-filter="true" id="fmjs-group-view"></ul>');

	var group = _.findWhere(groups, {id: id});
	$("#fmjs-group-header").html(group.title);

	var ids_to_show = _.where(feeds_groups, {group_id: id});
	
	feeds_to_show = ids_to_show[0].feed_ids.split(",");
	feeds_for_group = [];
	$.each(feeds_to_show, function(index, value) {
		feeds_for_group.push(parseInt(value, 10));
	});

	item_ids_in_group = '';
	$.each(items, function(index, value) {
		if ( $.inArray(value.feed_id, feeds_for_group ) !== -1 && value.is_read == 0 ) {

			var item = "";
			item += '<li data-theme="c"><p>';
			
			var feed = _.findWhere(feeds, {id: value.feed_id});
			item += getFavicon(feed);

			item += '<a href="#" onclick="showSingleItem('+_.escape(value.id)+')" class="fmjs-hot-links fmjs-item-is-unread fmjs-single-item-link-'+_.escape(value.id)+'">' + _.escape(value.title) + '</a>';
			item += ' by <a href="#" onclick="showFeed('+_.escape(feed.id)+');" class="fmjs-hot-links">'+_.escape(feed.title)+'</a>';
			item += '</p></li>';
			item_ids_in_group += value.id +",";
			$("#fmjs-group-view").append(item);
		}
	});
	$("#fmjs-group-content").data("fmjs-current-ids", item_ids_in_group);
	$("#fmjs-group-content").data("fmjs-current-group-id", id);
	if (called_group == false ) {
		called_group = true;
	} else {
		$("#fmjs-group-view").listview();
	}

	$.mobile.changePage("#page-group", {transition: "slide"});

}

function markGroupAsRead() {
	var data     = $("#fmjs-group-content").data("fmjs-current-ids");
	var group_id = $("#fmjs-group-content").data("fmjs-current-group-id");
	$("#fmjs-group-content").removeData("fmjs-current-ids");
	$("#fmjs-group-content").removeData("fmjs-current-group-id");
	markGroupRead("group", group_id, data);//what, id, ids
	$.mobile.changePage("#page-home", {transition: "slide"});
}

function markFeedAsRead() {
	var data     = $("#fmjs-feed-content").data("fmjs-feed-item-ids");
	var feed_id = $("#fmjs-feed-content").data("fmjs-feed-id");
	$("#fmjs-feed-content").removeData("fmjs-feed-item-ids");
	$("#fmjs-feed-content").removeData("fmjs-feed-id");
	markGroupRead("feed", feed_id, data);//what, id, ids
	$.mobile.changePage("#page-home", {transition: "slide"});
}


function showFeed(id) {

	$("#fmjs-feed-content").empty();
	$("#fmjs-feed-content").append('<ul data-divider-theme="d" data-inset="true" data-filter="true" id="fmjs-feed-view" data-role="listview"></ul>');
	$("#fmjs-feed-content").removeData("fmjs-feed-item-ids");
	$("#fmjs-feed-content").removeData("fmjs-feed-id");	
	called_feed_info = _.findWhere(feeds, {id: id});
	
	$("#fmjs-feed-header").html(called_feed_info.title);
	feed_items_shown = '';
	var items_to_show = _.where(items, {feed_id: id});

	$.each(items_to_show, function(index, value) {

		if ( value.is_read == "0" ) {
			feed_items_shown += value.id + ',';
			var item = "";
			item += '<li data-theme="c"><p>';
			
			item += getFavicon(called_feed_info);

			item += '<a href="#" class="fmjs-hot-links fmjs-item-is-unread fmjs-single-item-link-'+_.escape(value.id)+'" onclick="showSingleItem('+_.escape(value.id)+');">' + _.escape(value.title) + '</a>';
			item += '</p></li>';
			$("#fmjs-feed-view").append(item);
		}
	});
	
	$("#fmjs-feed-content").data("fmjs-feed-item-ids", feed_items_shown);
	$("#fmjs-feed-content").data("fmjs-feed-id", id);
	if (called_feed == false ) {
		called_feed = true;
	} else {
		$("#fmjs-feed-view").listview();
	}

	$.mobile.changePage("#page-feed", {transition: "slide"});
}


function refreshFavicons() {
	showHideLoader("start");
	$.post(fm_url + "?api&favicons", { api_key: fm_key }).done(function(data) {
		showHideLoader("stop");
		if ( checkAuth(data.auth) ) {
			favicons = data.favicons;
			$.jStorage.set("fmjs-favicons", favicons);
			console.log("Favicons refreshed");
		}
	}).fail(function(){ showHideLoader("stop"); checkAuth(0); });
}

function showSingleItem(id) {
	var item = _.findWhere(items, {id: id});
	//conso-le.log(item);
	
	//console.log(session_read_items);
	if ( item ) {
		session_read_items.push(item);
		console.log("cache hit");
		renderSingleItem(item);
	} else {
		// Could be a saved item...
		item = _.findWhere(saved_items, {id: id});
		if ( item ) {
			console.log("saved item hit");
			renderSingleItem(item);
		} else {
			// Let's check for unread_cache
			item = _.findWhere(session_read_items, {id: id});
			if ( item ) {
				console.log("unread_cache hit");
				renderSingleItem(item);
			} else {
				// Nothing, so load item
				console.log("Loading item");
				showHideLoader("start");
				$.post(fm_url + "?api&items&with_ids="+ _.escape(id), { api_key: fm_key }).done(function(data) {
					showHideLoader("stop");
					if ( checkAuth(data.auth) ) {
						session_read_items.push(data.items[0]);
						renderSingleItem(data.items[0]);
					}
				}).fail(function(){ showHideLoader("stop"); checkAuth(0); });			
			}
		}

	}
}

function saveCurrentItem() {
	var id = $("#fmjs-single-content").data("fmjs-single-item-current");
	saveItem(id);
	$("#fmjs-single-btn-save .ui-btn-text").html("Unsave");
	$("#fmjs-single-btn-save").attr("onclick", "unsaveCurrentItem();");
	$("#fmjs-single-btn-save" ).buttonMarkup({ icon: "delete" });

	return false;
}
function unsaveCurrentItem() {
	var id = $("#fmjs-single-content").data("fmjs-single-item-current");
	unsaveItem(id);
	$("#fmjs-single-btn-save .ui-btn-text").html("Save");
	$("#fmjs-single-btn-save").attr("onclick", "saveCurrentItem();");
	$("#fmjs-single-btn-save" ).buttonMarkup({ icon: "star" });

	return false;
}

function renderSingleItem(data) {
	$("#fmjs-single-content").html(data.html);
	$("#fmjs-single-content").data("fmjs-single-item-current", data.id);
	$("#fmjs-single-title").html(_.escape(data.title));

	$("#fmjs-single-url").attr("href", data.url);
	var meta = '';
	if (data.author) {
		meta += 'by ' + data.author + ' ';
	}
	meta += 'on ' + renderDate("long", data.created_on_time);
	$("#fmjs-single-meta").html(_.escape(meta));
	var feedname = _.findWhere(feeds, {id: data.feed_id});

	$("#fmjs-feed-title").html(_.escape(feedname.title));

	var favicon_img = getFavicon(feedname);

	$("#fmjs-single-feedname").html(favicon_img + _.escape(feedname.title));
	$("#fmjs-single-feedname").attr("onclick", "showFeed("+_.escape(data.feed_id)+");");

	markItemsRead(data.id.toString());
	if ( data.is_saved == 1 ) {
		$("#fmjs-single-btn-save .ui-btn-text").html("Unsave");
		$("#fmjs-single-btn-save").attr("onclick", "unsaveCurrentItem();");
		$("#fmjs-single-btn-save" ).buttonMarkup({ icon: "delete" });		
	}
	$.mobile.changePage("#page-single", {transition: "slide"});
}

function renderDate(how, timestamp) {
	if ( how == "long") {
		var date = new Date(timestamp*1000);
		var month =  date.getMonth();
		month++;
		var minutes = date.getMinutes();
		if (minutes < 10 ) {
			minutes = "0"+minutes;
		}
		var return_date = date.getDate() + '.' + month + '.' + date.getFullYear() + ' @ ' + date.getHours()+ ':' + minutes;
		return return_date;
	}
}

function markItemsRead(ids) {
	if ( _.isArray(ids) ) {
		// An array of ids
		ids_to_mark_read = ids;
	} else {
		// a comma seperated string
		ids_to_mark_read = ids.split(",");
	}

	items = _.reject(items, function(item) {
	
		if ( $.inArray(item.id.toString(), ids_to_mark_read ) == -1 )  {
			return false;
		} else {
			console.log("reject");
			return true;
		}
	});

	$.each(ids_to_mark_read, function(index, value) {
		markItemRead(value);
	});	

}
function markKindlingRead() {
	items = [];
	showHideLoader("start");
	$.post(fm_url + "?api", { api_key: fm_key, mark: "group", as: "read", id: 0, before: last_fmjs_refresh  }).done(function(data) {
		showHideLoader("stop");
		if ( checkAuth(data.auth) ) {
			console.log("Kindling marked as read");
			$.mobile.changePage("#page-home", {transition: "slide"});
		}
	}).fail(function(){ showHideLoader("stop"); checkAuth(0); });
}
function markGroupRead(what, id, ids) {
	if ( _.isArray(ids) ) {
		// An array of ids
		ids_to_mark_read = ids;
	} else {
		// a comma seperated string
		ids_to_mark_read = ids.split(",");
	}

	items = _.reject(items, function(item) {
	
		if ( $.inArray(item.id.toString(), ids_to_mark_read ) == -1 )  {
			return false;
		} else {
			console.log("reject");
			return true;
		}
	});
	
	if ( $.trim(id) != "") {
		showHideLoader("start");
		$.post(fm_url + "?api", { api_key: fm_key, mark: what, as: "read", id: $.trim(_.escape(id)), before: last_fmjs_refresh  }).done(function(data) {
			showHideLoader("stop");
			if ( checkAuth(data.auth) ) {
				console.log("Group marked as read");
				$.mobile.changePage("#page-home", {transition: "slide"});
			}
		}).fail(function(){ showHideLoader("stop"); checkAuth(0); });
	}
}

function markItemRead(id) {
	if ( $.trim(id) != "") {
		$(".fmjs-single-item-link-"+id).removeClass("fmjs-item-is-unread").addClass("fmjs-item-is-read");
		showHideLoader("start");
		$.post(fm_url + "?api", { api_key: fm_key, mark: "item", as: "read", id: $.trim(_.escape(id))  }).done(function(data) {
			showHideLoader("stop");
			if ( checkAuth(data.auth) ) {
				console.log("Marked as read");
			}
		}).fail(function(){ showHideLoader("stop"); checkAuth(0); });
	}
}

function saveItem(id) {
	id = $.trim(id);
	if ( id != "") {

		//var local_items = $.jStorage.get("fmjs-local-items", []);
		var item = _.findWhere(items, {id: id});

		if ( item ) {
			//
			item.is_saved = 1;
			saved_items.push(item);
			$.jStorage.set("fmjs-local-items", saved_items);
		} else {

			item = _.findWhere(session_read_items, {id: id});
			
			if ( item ) {
				item.is_saved = 1;
				saved_items.push(item);
				$.jStorage.set("fmjs-local-items", saved_items);
			}
			
		}
		showHideLoader("start");
		$.post(fm_url + "?api", { api_key: fm_key, mark: "item", as: "saved", id: $.trim(_.escape(id))  }).done(function(data) {
			showHideLoader("stop");
			if ( checkAuth(data.auth) ) {
				console.log("Saved item on server.");
			}
		}).fail(function(){ showHideLoader("stop"); checkAuth(0); });
	}
}

function unsaveItem(id) {
	if ( $.trim(id) != "") {
		//var saved_items = $.jStorage.get("fmjs-local-items", []);
		current_unsave_id = id;
		saved_items = _.reject(saved_items, function(item) {
			if ( item.id != current_unsave_id )  {
				return false;
			} else {
				console.log("reject");
				return true;
			}
		});
		$.jStorage.set("fmjs-local-items", saved_items);

		showHideLoader("start");
		$.post(fm_url + "?api", { api_key: fm_key, mark: "item", as: "unsaved", id: $.trim(_.escape(id))  }).done(function(data) {
			showHideLoader("stop");
			if ( checkAuth(data.auth) ) {
				console.log("Unsaved item on server.");
			}
		}).fail(function(){ showHideLoader("stop"); checkAuth(0); });
	}
}

function checkAuth(auth) {
	if ( auth == 1 ) {
		return true;
	} else {
		if ( auth_success == true ) {
			// it was once successful, so it's probably a network issue,
			// a stop or anything else, just log it, and don't do anything at all.
			// an alert would be ok too, but this might be unwise, as 
			// initial loading can happen quite often...
			console.log("Probably stopped or network issue.");
		} else {
			console.log("Forbidden");
			alert("Please check your Login-credentials. This could also mean, that your internet connection is lost. Or maybe you stopped loading a page.");	

			$.mobile.changePage("#page-settings", {transition: "slide"});
			return false;		
		}

	}
}

function showSparks() {

	$("fmjs-sparks-content").empty();
	$("fmjs-sparks-content").append('<ul data-role="listview" data-divider-theme="d" data-inset="true" id="fmjs-sparks-view"></ul>');

	var spark_feeds = _.where(feeds, {is_spark: 1});
	
	feeds_for_sparks = [];
	$.each(spark_feeds, function(index, value) {
		feeds_for_sparks.push(parseInt(value.id, 10));
	});

	item_ids_in_sparks = '';
	$.each(items, function(index, value) {
		if ( $.inArray(value.feed_id, feeds_for_sparks ) !== -1 && value.is_read == 0 ) {

			var item = "";
			item += '<li data-theme="c"><p>';
			
			var feed = _.findWhere(feeds, {id: value.feed_id});
			item += getFavicon(feed);
			
			item += '<a href="#" onclick="showSingleItem('+_.escape(value.id)+')" class="fmjs-hot-links fmjs-item-is-unread fmjs-single-item-link-'+_.escape(value.id)+'">' + _.escape(value.title) + '</a>';
			item += '</p></li>';
			item_ids_in_sparks += value.id +",";
			$("#fmjs-sparks-view").append(item);
		}
	});
	$("#fmjs-group").data("fmjs-current-ids", item_ids_in_sparks);
	if (called_sparks == false ) {
		called_sparks = true;
	} else {
		$("#fmjs-sparks-view").listview();
	}
	$.mobile.changePage("#page-sparks", {transition: "slide"});

}

function logout() {
	$.jStorage.deleteKey("fmjs-key");
	$.jStorage.deleteKey("fmjs-url");
	$.jStorage.deleteKey("fmjs-user");
	$.jStorage.deleteKey("fmjs-favicons");
	$.jStorage.deleteKey("fmjs-local-items");
	fm_key   = '';
	fm_url   = '';
	fm_user  = '';
	favicons = '';
	start();
}

function showAllFeeds() {
	$("#fmjs-all-feeds-content").empty();
	$("#fmjs-all-feeds-content").append('<ul data-role="listview" data-divider-theme="d" data-inset="true" data-filter="true" id="fmjs-all-feeds-view"></ul>');
	
	$.each(feeds, function(index, value){

		var item = '';
		item += '<li>';
		item += '<a onclick="showFeed('+_.escape(value.id)+')">';
		
		item += getFavicon(value, "ui-li-icon ui-corner-none");
		
		item += _.escape(value.title)+'</a>';
		item += '</li>';

		$("#fmjs-all-feeds-view").append(item);
		
	});
	
	if (called_all_feeds == false ) {
		called_all_feeds = true;
	} else {
		$("#fmjs-all-feeds-view").listview();
	}

	$.mobile.changePage("#page-all-feeds", {transition: "slide"});
}

function showHideLoader(state) {
	if ( state == "start" ) {
		loading++;
	} else {
		loading--;
	}
	
	if ( loading == 0 ) {
		$.mobile.loading( "hide" );
	}
	
	if ( loading == 1 && state == "start") {
		$.mobile.loading( "show", {
			text: "Loading...",
			textVisible: true,
			theme: "b",
		});
	}
}

function showKindling() {
	$("#fmjs-kindling-content").empty();
	$("#fmjs-kindling-content").append('<ul data-role="listview" data-divider-theme="d" data-inset="true" data-filter="true" id="fmjs-kindling-view"></ul>');

	$.each(items, function(index, value) {
		if ( value.is_read == 0 ) {

			var item = "";
			item += '<li data-theme="c"><p>';
			
			var feed = _.findWhere(feeds, {id: value.feed_id});
			item += getFavicon(feed);

			item += '<strong><a href="#" onclick="showSingleItem('+_.escape(value.id)+')" class="fmjs-hot-links fmjs-item-is-unread fmjs-single-item-link-'+_.escape(value.id)+'">' + _.escape(value.title) + '</a></strong>';
			item += ' by <a href="#" onclick="showFeed('+_.escape(feed.id)+');" class="fmjs-hot-links">'+_.escape(feed.title)+'</a>';
			item += '</p></li>';

			$("#fmjs-kindling-view").append(item);
		}
	});

	if (called_kindling == false ) {
		called_kindling = true;
	} else {
		$("#fmjs-kindling-view").listview();
	}

	$.mobile.changePage("#page-kindling", {transition: "slide"});

}

function getFavicon(feed, css_classes) {
	// should a a feed-object
	if ( !!css_classes ) {

	} else {
		var css_classes = "fmjs-favicon";
	}
	
	var favicon = _.findWhere(favicons, {id: feed.favicon_id});
	var item_data = '';
	if ( favicon ) {
		if ( favicon.id != 1) {
			// return feed specific favicon
			return '<img src="data:'+favicon.data+'" height="16" width="16" class="'+css_classes+'"/>';
		}
	}
	
	// return generic code
	return '<img src="feed-icon-generic.png" height="16" width="16" class="'+css_classes+'"/>';
}

function showHome() {

}

function countUnread() {

}

function compareSavedItems(what) {
	// This function compares your local stored items with all saved items online.
	// if some are missing here, we load them.
	// if some are missing there, we remove our copy (beacuse it was probably unsaved somewhere else...).
	// It is done by comparing ids
	
	if ( what == "full" ) {
		refreshSavedItems();
		return;
	}
	showHideLoader("start");
	$.post(fm_url + "?api&saved_item_ids", { api_key: fm_key }).done(function(data) {
		showHideLoader("stop");
		if ( checkAuth(data.auth) ) {
			var online_ids = data.saved_item_ids.split(',');
			console.log("Anzahl saved online: " + online_ids.length);
			local_ids = [];
			$.each(saved_items, function(index, value) {
				local_ids.push(value.id.toString());
			});
			console.log("Anzahl local: " + local_ids.length);
			var load_em = _.difference(online_ids, local_ids);
			console.log(load_em);
			delete_em =  _.difference(local_ids, online_ids);
			console.log(delete_em);
			
			if ( load_em.length > 0 ) {
				if ( what == "start" && load_em.length > 50 ) {
					// too much to load on start, this should be done with a full refresh...
					// adding a message to top
					$("#fmjs-homescreen-message").append('<div class="warning">Please reload your saved items in the settings screen (click to hide message).</div>');
					return;
					
				} else {
					processLoadedSaveItems = _.after(load_em.length, storeLoadedSavedItems);
					loadSavedItems(load_em);
				}
			}
			
			if ( delete_em.length > 0 ) {
				saved_items = _.reject(items, function(item) {
	
					if ( $.inArray(item.id.toString(), delete_em ) == -1 )  {
						return false;
					} else {
						console.log("reject");
						return true;
					}
				});
			}
			$.jStorage.set("fmjs-local-items", saved_items);

		}
	}).fail(function(){ showHideLoader("stop"); checkAuth(0); });
}
