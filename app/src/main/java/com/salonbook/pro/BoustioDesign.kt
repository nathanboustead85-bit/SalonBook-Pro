package com.salonbook.pro

import android.graphics.Color
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.content.Context
import android.view.View

internal object BoustioDesign {
    val teal = Color.rgb(0,139,131)
    data class Tile(val kind: String, val background: Int, val foreground: Int)
    private fun tile(kind: String, bg: String, fg: String) = Tile(kind, Color.parseColor(bg), Color.parseColor(fg))
    fun tileFor(title: String): Tile {
        val t = title.lowercase(java.util.Locale.ROOT)
        return when {
            t.contains("settings") && !t.startsWith("back") -> tile("gear","#E0F3ED","#168579")
            t.contains("appointment clients") -> tile("history","#F0E9F8","#79559F")
            t.contains("client directory") -> tile("contact","#F0E9F8","#79559F")
            t.startsWith("back") -> tile("back","#E0F3ED","#168579")
            t.contains("new appointment") -> tile("add","#E0F3ED","#168579")
            t.contains("calendar") || t.contains("availability") && !t.contains("staff") -> tile("calendar","#E7EFFB","#426DA5")
            t.contains("client") || t.contains("customer management") -> tile("people","#F0E9F8","#79559F")
            t.contains("appointments") || t.contains("booking") && !t.contains("link") -> tile("list","#FCF0DF","#946B29")
            t.contains("service") || t.contains("price") -> tile("scissors","#FCE9ED","#A34F6B")
            t.contains("staff") || t.contains("employee") -> tile("people","#E5F1F5","#39788D")
            t.contains("report") -> tile("chart","#E9F2E1","#52783A")
            t.contains("message") -> tile("chat","#EAEAFA","#635DA4")
            t.contains("portfolio") -> tile("image","#FCE9ED","#A34F6B")
            t.contains("payment") || t.contains("billing") -> tile("wallet","#FCF0DF","#946B29")
            t.contains("cloud") -> tile("cloud","#E7EFFB","#426DA5")
            t.contains("link") -> tile("link","#E0F3ED","#168579")
            t.contains("marketing") -> tile("star","#FCE9ED","#A34F6B")
            else -> tile("grid","#E0F3ED","#168579")
        }
    }
}
internal class FeatureIcon(context: Context, private val tile: BoustioDesign.Tile): View(context) {
    private val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { color=tile.foreground; style=Paint.Style.STROKE; strokeWidth=1.7f; strokeCap=Paint.Cap.ROUND; strokeJoin=Paint.Join.ROUND }
    init { importantForAccessibility=IMPORTANT_FOR_ACCESSIBILITY_NO }
    override fun onDraw(c: Canvas) {
        super.onDraw(c)
        val side = minOf(width,height)*0.52f
        c.save(); c.translate((width-side)/2,(height-side)/2); c.scale(side/24,side/24)
        fun line(a:Float,b:Float,d:Float,e:Float)=c.drawLine(a,b,d,e,p)
        fun rect(a:Float,b:Float,d:Float,e:Float)=c.drawRoundRect(RectF(a,b,d,e),2f,2f,p)
        fun circle(a:Float,b:Float,r:Float)=c.drawCircle(a,b,r,p)
        when(tile.kind) {
            "calendar","add" -> { rect(3f,5f,21f,21f); line(3f,10f,21f,10f); line(7f,3f,7f,7f); line(17f,3f,17f,7f); if(tile.kind=="add"){line(8f,15f,16f,15f);line(12f,11f,12f,19f)} else {circle(8f,14f,0.7f);circle(12f,14f,0.7f);circle(16f,14f,0.7f)} }
            "gear" -> {circle(12f,12f,7f);circle(12f,12f,3f);for(i in 0..7){c.save();c.rotate(i*45f,12f,12f);line(12f,2f,12f,5f);c.restore()}}
            "history" -> {rect(3f,4f,21f,21f);line(3f,9f,21f,9f);circle(13f,15f,4f);line(13f,12f,13f,15f);line(13f,15f,16f,15f)}
            "contact" -> {rect(4f,3f,21f,22f);circle(13f,9f,3f);c.drawArc(RectF(7f,13f,19f,23f),180f,180f,false,p);line(2f,7f,5f,7f);line(2f,17f,5f,17f)}
            "people" -> {circle(9f,7f,3f);circle(18f,9f,2.5f);c.drawArc(RectF(2f,12f,16f,25f),180f,180f,false,p);c.drawArc(RectF(14f,14f,23f,24f),210f,150f,false,p)}
            "list" -> {rect(5f,4f,20f,22f);rect(9f,2f,16f,6f);for(y in listOf(10f,14f,18f))line(9f,y,16f,y)}
            "scissors" -> {circle(6f,6f,3f);circle(6f,18f,3f);line(8f,8f,21f,20f);line(8f,16f,21f,4f)}
            "chart" -> {line(3f,3f,3f,21f);line(3f,21f,22f,21f);line(8f,18f,8f,12f);line(13f,18f,13f,8f);line(18f,18f,18f,4f)}
            "chat" -> {rect(3f,4f,21f,17f);line(7f,17f,5f,22f);line(5f,22f,12f,17f);line(7f,9f,17f,9f);line(7f,13f,14f,13f)}
            "back" -> {line(20f,12f,4f,12f);line(4f,12f,10f,6f);line(4f,12f,10f,18f)}
            "image" -> {rect(3f,3f,21f,21f);circle(8f,8f,2f);line(4f,18f,12f,10f);line(12f,10f,20f,18f)}
            "wallet" -> {rect(3f,5f,21f,20f);rect(14f,10f,22f,15f)}
            "cloud" -> {c.drawArc(RectF(2f,9f,12f,19f),90f,210f,false,p);c.drawArc(RectF(7f,3f,19f,17f),190f,180f,false,p);c.drawArc(RectF(14f,9f,23f,19f),270f,180f,false,p);line(7f,19f,18f,19f)}
            "link" -> {c.save();c.rotate(-45f,12f,12f);rect(3f,8f,13f,16f);rect(11f,8f,21f,16f);c.restore()}
            "star" -> {line(12f,2f,12f,22f);line(2f,12f,22f,12f);line(5f,5f,19f,19f);line(5f,19f,19f,5f)}
            else -> {for(x in listOf(3f,13f))for(y in listOf(3f,13f))rect(x,y,x+8f,y+8f)}
        }
        c.restore()
    }
}
