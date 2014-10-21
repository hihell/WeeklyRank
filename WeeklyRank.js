var AV   = require('avoscloud-sdk').AV;
var http = require('http');
var fs   = require('fs');
var cheerio = require('cheerio');
// Use AV.Cloud.define to define as many cloud functions as you want.
// For example:
AV.initialize("xv1cgfapsn90hyy2a42i9q6jg7phbfmdpt1404li6n93tt2r", "70sp4h8prccxzyfp56vwm9ksczji36bsrjvtwzvrzegfza67");

function CrawlSearchingCount(appname,engine,time)
{
    //console.log("Enter Crawl code!\n");
    console.log("搜索内容："+ appname + "\n");
    var url = "";// 搜索引擎url
    //console.log("Your searching engine is :" + engine + "\n");
    // 根据搜索引擎类型决定访问url
    switch(engine)
    {
        case "baidu"  :
            url = "http://www.baidu.com/s?q1=" + appname + "&q2=&q3=&q4=&rn=10&lm=" + time + "&ct=0&ft=&q5=&q6=&tn=baiduadv";
            break;
        case "google" :
            url = "http://www.google.com/search?q=" + appname + "&gws_rd=ssl";
            break;
    }
    //console.log("The searching url is :" + url + "\n");
    // 访问url页面
    http.get(url,function(res){
        var size   = 0;
        var chunks = [];
        //监听data事件
        res.on("data",function(chunk){
            size += chunk.length;
            chunks.push(chunk);
        });
        // 数据获取完毕事件
        res.on("end",function(){
	    //console.log("Get Data successfully!\n");
            // 连接多次data的buff
            var data = Buffer.concat(chunks,size);
            // 从data页面中提取html元素
            $ = cheerio.load(data);
            // 初始化临时变量
	    var pure_text = "";
	    var nums_text = "";
	    // 根据引擎分别在不同的地方爬取搜索量字符信息
	    if(engine == "baidu")
            {
                pure_text = $(".nums").text();
                //console.log(pure_text+"\n");
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
	    // 将搜索量字符信息转化为数值信息
	    var end_pos = -0, start_pos = -3, muti = 1;
	    for(var i=0; i<nums_text.length/4; i++)
	    {
		// 保证起始位置不会越界（比字符串长度更长）
		if(start_pos <= (-1)*nums_text.length) start_pos = 0;
		//console.log("start:"+start_pos+" end:"+end_pos+" muti:"+muti+" result:"+nums);
		var slice = "";
		// 第一次划分时没有end_pos
		if(i == 0)
		{
		    slice = nums_text.slice(start_pos);
		}
		else
		{
		    slice = nums_text.slice(start_pos,end_pos);
		}
		// 三位数累加
		nums = nums + parseInt(slice)*muti;
		//console.log("slice:"+slice);
		start_pos -= 4; end_pos -=4; muti *= 1000;
	    }
	    console.log("count is "+nums);
	    return nums; 
        });
    });
}

// CrawlSearchingCount("大姨","baidu",1);

function AppRank(appname,time)
{
    // 参数初始化 
    var appnum      = "", id = "";
    // search信息查询
    var max_search  = 1000000000000, search  = CrawlSearchingCount(appname,"baidu",time)*0.7 + CrawlSearchingCount(appname,"baidu",time)*0.3, add_search = 1000;
    // like、comment信息查询
    var max_like    = "", like    = "", add_like = 10; 
    var max_comment = "", comment = "", add_comment = 20;
     // 数据库信息查询
    var Product = AV.Object.extend("Product");
    var query = new AV.Query(Product);
    query.equalTo("name", appname);
    query.find({
	success: function(results) {
    	    console.log("Successfully retrieved " + results.length + " name.");
    	    // Do something with the returned AV.Object values
    	    for (var i = 0; i < results.length; i++) {
   	        var object = results[i];
		// 获取app在数据库中主键
		id = object.id;
	        console.log(object.id + ' - ' + object.get('name'));
		// 查询
		var ProductState = AV.Object.extend("ProductState");
		var query = new AV.Query(ProductState);
		query.equalTo("product", object);
		query.find({
		    success: function(results) {
			console.log("Successfully retrieved " + results.length + " name.");
			for (var i = 0; i < results.length; i++) {
			    var object_ = results[i];
			    like    = object_.voteCount;
			    comment = object_.commentCount;
			    console.log("like:" + like + ' - ' + "comment" + comment);
			}
	     	    },
		    error: function(error) {
			console.log("Error: " + error.code + " " + error.message);
		    }
		}); 
	    }
    	},
    	error: function(error) {
    	    console.log("Error: " + error.code + " " + error.message);
    	}
    });
    console.log("The State info is: \n");
    
     
    var max_download = 10000000, download = 10000000, add_download = 10000;  
    // 热度
    var A = download/(max_download*2) + (search*3)/(max_search*10) + comment/(max_comment*10) + like/(max_like*10);
    // 好评度
    var B = 4.5;
    // 上升度
    var C = add_download/(download*2) + (add_search*3)/(search*10) + add_comment/(comment*10) + add_like/(like*10);
    // 最终排名
    var Rank = 0.25 * A + 0.35 * B + 0.4 * C;
    return Rank;
}


function test()
{
	var ProductState = AV.Object.extend("ProductState");
                var query = new AV.Query(ProductState);
                query.equalTo("product", "");
                query.find({ 
                    success: function(results) {
                        console.log("Successfully retrieved " + results.length + " name.");
                        for (var i = 0; i < results.length; i++) {
                            var object_ = results[i];
                            like    = object_.get("voteCount");
                            comment = object_.get("commentCount");
                            console.log("like:" + like + ' - ' + "comment" + comment);
                        }
                    },
                    error: function(error) {
                        console.log("Error: " + error.code + " " + error.message);
                    }  
                });

}

test();

//AppRank("灵感",1);
