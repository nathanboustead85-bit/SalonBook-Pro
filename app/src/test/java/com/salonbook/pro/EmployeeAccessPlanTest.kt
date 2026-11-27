package com.salonbook.pro
import org.junit.Assert.*
import org.junit.Test
class EmployeeAccessPlanTest {
 @Test fun unknownRolesFailClosed() {
  for (role in listOf("", "Owner", "admin", "unknown")) assertEquals("No access", EmployeeAccessPlan.normalise(role))
 }
 @Test fun validRolesRoundTrip() {
  EmployeeAccessPlan.roles.forEach { assertEquals(it, EmployeeAccessPlan.normalise(it)) }
 }
}
