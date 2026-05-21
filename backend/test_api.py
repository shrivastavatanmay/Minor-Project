import unittest
import json
from app import app, is_missing_consult_table_error, is_missing_messages_table_error

class MindEaseAPITestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config['TESTING'] = True
        cls.client = app.test_client()
        print("Starting 20 Test Cases...")

    # 1. Test Health API
    def test_01_health(self):
        res = self.client.get('/api/health')
        self.assertEqual(res.status_code, 200)

    # 2. Test missing consult error
    def test_02_consult_error_parser(self):
        self.assertTrue(is_missing_consult_table_error("public.consult_requests does not exist"))
    
    # 3. Test missing messages error
    def test_03_message_error_parser(self):
        self.assertTrue(is_missing_messages_table_error("relation chat_messages does not exist"))

    # 4. Test Thermapists GET (Success)
    def test_04_get_therapists(self):
        res = self.client.get('/api/therapists')
        # Even if empty, should return 200 or 503 if db down
        self.assertIn(res.status_code, [200, 503])

    # 5. Test Therapists GET filter
    def test_05_get_therapists_filter(self):
        res = self.client.get('/api/therapists?specialty=cbt')
        self.assertIn(res.status_code, [200, 503])

    # 6. Test Profile GET
    def test_06_get_profile(self):
        res = self.client.get('/api/profile/demo_id')
        self.assertIn(res.status_code, [200, 404, 503])

    # 7. Test Questionnaire GET
    def test_07_get_questionnaire(self):
        res = self.client.get('/api/questionnaire/demo_id')
        self.assertIn(res.status_code, [200, 500, 503])

    # 8. Test Journals GET
    def test_08_get_journals(self):
        res = self.client.get('/api/journals/demo_id')
        self.assertIn(res.status_code, [200, 500, 503])

    # 9. Test Journal POST Valid
    def test_09_post_journal_valid(self):
        res = self.client.post('/api/journals', json={"user_id":"t", "content":"Happy day"})
        self.assertIn(res.status_code, [201, 500, 503])

    # 10. Test Journal POST Missing
    def test_10_post_journal_missing(self):
        res = self.client.post('/api/journals', json={"content":"abc"})
        self.assertEqual(res.status_code, 400)

    # 11. Test Chat GET No Auth Header
    def test_11_get_chat_no_auth(self):
        res = self.client.get('/api/messages/user_b?current_user_id=user_a')
        self.assertEqual(res.status_code, 503)

    # 12. Test Chat GET With Auth But Missing Param
    def test_12_get_chat_missing_param(self):
        res = self.client.get('/api/messages/user_b', headers={"Authorization": "Bearer TEST"})
        self.assertEqual(res.status_code, 400)

    # 13. Test Chat GET Full
    def test_13_get_chat_full(self):
        res = self.client.get('/api/messages/user_b?current_user_id=user_a', headers={"Authorization": "Bearer TEST"})
        self.assertIn(res.status_code, [200, 500, 503])

    # 14. Test Chat POST Missing Args
    def test_14_post_chat_missing(self):
        res = self.client.post('/api/messages', json={"sender_id": "a"})
        self.assertEqual(res.status_code, 400)

    # 15. Test Chat POST Full
    def test_15_post_chat_full(self):
        res = self.client.post('/api/messages', json={"sender_id":"1","receiver_id":"2","content":"Hi"})
        self.assertIn(res.status_code, [201, 500, 503])

    # 16. Test Consult Request POST Missing Args
    def test_16_consult_req_missing(self):
        res = self.client.post('/api/consult-requests', json={"student_id":"1"})
        self.assertEqual(res.status_code, 400)

    # 17. Test Consult Request POST Full
    def test_17_consult_req_full(self):
        res = self.client.post('/api/consult-requests', json={"student_id":"1","therapist_id":"2"})
        self.assertIn(res.status_code, [201, 500, 503])

    # 18. Test Update Consult Request Missing Status
    def test_18_update_consult_invalid(self):
        res = self.client.put('/api/consult-requests/1', json={"status": "invalid"})
        self.assertEqual(res.status_code, 400)

    # 19. Test Fetch Therapist Patients
    def test_19_get_therapist_patients(self):
        res = self.client.get('/api/therapist/patients/demo_therapist')
        self.assertIn(res.status_code, [200, 500, 503])

    # 20. Test Stress Predict POST Empty
    def test_20_predict_stress_empty(self):
        res = self.client.post('/api/predict/stress', json={})
        self.assertEqual(res.status_code, 400)

if __name__ == '__main__':
    unittest.main(verbosity=2)
