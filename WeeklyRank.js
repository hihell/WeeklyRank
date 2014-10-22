/*******************************************************************************************************
 * @ProjectName: WeeklyRank (function)
 * @Author:      Woodie
 * @Version:     0.1.1
 * @CreateTime:  Wed, Oct 22, 2014
 * @Description: We can call this function to get the apps' rank from Baidu and Google.
 *               This function need two arg: "appname" & "rankCallback".
 *               Finally, It will return the Rank Value, and store it in avos server.
 * @Hint:        1.We recommend that it is better to use lib-"request" to send http request,
 *               Here we still use lib-"http", we will promote it at this point later
 *               2.When we use "promise", it is important that we need add "function(){...}" into "then()",
 *               rather than use our own function name, eg : t.save().then(Myfunction);
 *******************************************************************************************************/

var AV   = require('avoscloud-sdk').AV;
var http = require('http');
var fs   = require('fs');
var cheerio = require('cheerio');

// Init AVOS Cloud
AV.initialize("xv1cgfapsn90hyy2a42i9q6jg7phbfmdpt1404li6n93tt2r", "70sp4h8prccxzyfp56vwm9ksczji36bsrjvtwzvrzegfza67");

// Global Variable
var BaiduCount  = 0;
var GoogleCount = 0;

// Crawling Count from SeachEngine
// Para Description:
//  appname      : the app need searched ;
//  engine       : where do you want to search ;
//  time         : search the info daily or weekly (time = 1 or time = 7);
//  httpCallback : The callback function when http request is over.
function CrawlSearchingCount(appname, engine, time)
{
    console.log("The content of Searching: "+ appname + "\n");
    // The url of SearchEngine
    var url = "";
    // Chose the SearchEngine
    switch(engine)
    {
        case "baidu"  :
            url = "http://www.baidu.com/s?q1=" + appname + "&q2=&q3=&q4=&rn=10&lm=" + time + "&ct=0&ft=&q5=&q6=&tn=baiduadv";
            break;
        case "google" :
            url = "http://www.google.com/search?q=" + appname + "&gws_rd=ssl";
            break;
    }
    // GET : HTTP request
    http.get(url,function(res){
        var size   = 0;
        var chunks = [];
        // Listening the data event
        res.on("data",function(chunk){
            size += chunk.length;
            chunks.push(chunk);
        });
        // Data getting over event
        res.on("end",
            // The callback of getting data over event
            // In this function, we get all app's info count
            function(){
                var data = Buffer.concat(chunks,size);
                // Get the html from 'data'(String)
                $ = cheerio.load(data);
                // Init tmp variable
                var pure_text = "";
                var nums_text = "";
                // Crawling data from different SearchEngine
                if(engine == "baidu")
                {
                    pure_text = $(".nums").text();
                    nums_text = pure_text.slice(11,-1);
                    //console.log(nums_text+"\n");
                }
                else if(engine == "google")
                {
                    pure_text = $("#resultStats").text();
                    //console.log(pure_text+"\n");
                    nums_text = pure_text.slice(4,-4);
                    //console.log(nums_text+"\n");
                }
                var nums = 0;
                // Transfer the String to real number
                var end_pos = -0, start_pos = -3, muti = 1;
                for(var i=0; i<nums_text.length/4; i++)
                {
                    // Ensure that the start pos will not cross the border
                    if(start_pos <= (-1)*nums_text.length) start_pos = 0;
                    //console.log("start:"+start_pos+" end:"+end_pos+" muti:"+muti+" result:"+nums);
                    var slice = "";
                    // When the first time slice, there is no end pos
                    if(i == 0)
                    {
                        slice = nums_text.slice(start_pos);
                    }
                    else
                    {
                        slice = nums_text.slice(start_pos,end_pos);
                    }
                    // Summation
                    nums = nums + parseInt(slice)*muti;
                    //console.log("slice:"+slice);
                    start_pos -= 4; end_pos -=4; muti *= 1000;
                }
                //console.log("count is "+nums);
                // Store the result in global variable
                if(engine == "baidu")
                {
                    BaiduCount = nums;
                    console.log("BaiduCount : " + BaiduCount);
                }
                else if(engine == "google")
                {
                    GoogleCount = nums;
                    console.log("GoogleCount : " + GoogleCount);
                }
            });
    });
}


// The main funciton...
exports.Rank = function(appname, time, rankCallback)
{
    var appObj;
    var Rank = 0;
    // Init para by default value
    var max_search   = 1000000000000, search  = 10000,   add_search = 1000;
    var max_like     = 10000,         like    = 100,     add_like = 10;
    var max_comment  = 10000,         comment = 100,     add_comment = 20;
    var max_download = 10000000,      download = 100000, add_download = 10000;

    // Store the count in avos server
    function avosStoreCount(time, Rank)
    {
        var list = "";
        if(time == "7")
        {
            list = "WeeklyRank";
        }
        else if(time == "1")
        {
            list = "DailyRank";
        }
        var LIST = AV.Object.extend(list);
        var List = new LIST();
        List.set("name", appname);
        List.set("product", appObj);
        List.set("rankValue", Rank);
        List.set("searchCount", search);
        return List.save(null, {
            success: function(List) {
                // Execute any logic that should take place after the object is saved.
                console.log('New object created with objectId: ' + List.id);
            },
            error: function(gameScore, error) {
                // Execute any logic that should take place if the save fails.
                // error is a AV.Error with an error code and description.
                console.log('Failed to create new object, with error code: ' + error.description);
            }
        });
    }
    // Get app id in the list "product"
    function GetProductObj(appname)
    {
        console.log("Getting Product's objID ..");
        var Product = AV.Object.extend("Product");
        var query = new AV.Query(Product);

        query.equalTo("name", appname);
        return query.first({
            success: function(object) {
                // Successfully retrieved the object.
                appObj = object;
                console.log("Product's objID : " + object.id + ' - ' + object.get('name'));
            },
            error: function(error) {
                console.log("Error: " + error.code + " " + error.message);
            }
        });
    }
    // Get all apps' max comment count & max like count
    function GetMax(type)
    {
        console.log("Getting Product's max " + type + " ..");
        var ProductState = AV.Object.extend("ProductState");
        var query = new AV.Query(ProductState);

        query.descending(type);
        return query.first({
            success: function(object) {
                //console.log("Successfully retrieved " + results.length + " name.");
                if(type == "voteCount" && object.get("voteCount") != undefined) {
                    max_like = object.get("voteCount");
                    console.log("Product's max voteCount : " + max_like);
                }
                else if(type == "commentCount" && object.get("commentCount") != undefined) {
                    max_comment = object.get("commentCount");
                    console.log("Product's max comment : " + max_comment);
                }
            },
            error: function(error) {
                console.log("Error: " + error.code + " " + error.message);
            }
        });
    }
    // Get app's comment count & like count
    function GetLikeAndComment()
    {
        console.log("Getting Product's like and comment ..");
        var ProductState = AV.Object.extend("ProductState");
        var query = new AV.Query(ProductState);

        query.equalTo("product", appObj);
        return query.first({
            success: function(object) {
                //console.log("Successfully retrieved " + results.length + " name.");
                if(object.get("voteCount") != undefined)
                    like    = object.get("voteCount");
                if(object.get("commentCount") != undefined)
                    comment = object.get("commentCount");
                console.log("Product's info | like : " + like + ' - ' + "comment : " + comment);
            },
            error: function(error) {
                console.log("Error: " + error.code + " " + error.message);
            }
        });
    }
    // Calculating the count
    function calculateCount()
    {
        console.log("Calculating Rank, please wait ..");
        // Get some para from avosServer
        // Create a promise array to store which promises need be done parallel..
        var promises = [];
        promises.push(GetMax("voteCount"));
        promises.push(GetMax("commentCount"));
        AV.Promise.when(promises).then(function(){
                GetProductObj(appname);
        }).then(function(){
                GetLikeAndComment();
        }).then(function(){
            // Calculating!!!
            search  = BaiduCount*0.7 + BaiduCount*0.3;
            console.log("Formula Para | download : " + download + " \tmax_download : " + max_download + " \tadd_download : " + add_download + "\n" +
                        "             | search : " + search + " \tmax_search : " + max_search + " \tadd_search : " + add_search  + "\n" +
                        "             | comment : "+ comment + " \tmax_comment : " + max_comment + " \tadd_comment : " + add_comment  + "\n" +
                        "             | like : " + like + " \tmax_like : " + max_like + " \tadd_like : " + add_like);
            //      Popularity
            var A = download/(max_download*2) + (search*3)/(max_search*10) + comment/(max_comment*10) + like/(max_like*10);
            console.log("Rank_A = " + A);
            //      Score
            var B = 4.5;
            console.log("Rank_B = " + B);
            //      Rising degree
            var C = add_download/(download*2) + (add_search*3)/(search*10) + add_comment/(comment*10) + add_like/(like*10);
            console.log("Rank_C = " + C);
            //      Rank
            Rank = 0.25 * A + 0.35 * B + 0.4 * C;
            console.log("Rank = " + Rank);
            avosStoreCount(time, Rank).then(function(){rankCallback(Rank);})
            //rankCallback(Rank);
        });
    }
    // Store Data in Baidu callback function
    // Collect all store operation to do parallel
    // It will do ... not until all promise is over

    // Crawling Data from Internet
    // And call the httpCallback to calculate Rank and store the result in AVOS Server
    var promiseCrawling = [];
    promiseCrawling.push(CrawlSearchingCount(appname, "baidu", time));
    promiseCrawling.push(CrawlSearchingCount(appname, "baidu", time));
    AV.Promise.when(promiseCrawling).then(function(){calculateCount()});
}



